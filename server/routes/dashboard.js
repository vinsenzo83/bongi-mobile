import { Router } from 'express';
import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const router = Router();

// 에이전트 + 태스크 + Git 상태 통합 API
router.get('/agents', (req, res) => {
  // 1. 활성 에이전트 확인 (팀 config 파일에서)
  const agents = [];
  const teamsDir = join(process.env.HOME || process.env.USERPROFILE, '.claude', 'teams');
  try {
    if (existsSync(teamsDir)) {
      const teams = readdirSync(teamsDir);
      teams.forEach(team => {
        const configPath = join(teamsDir, team, 'config.json');
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf8'));
          (config.members || []).forEach(m => {
            agents.push({
              name: m.name,
              team,
              agentType: m.agentType || 'unknown',
              status: 'idle',
              task: null,
            });
          });
        }
      });
    }
  } catch (e) { /* no teams */ }

  // 2. 태스크 현황 (tasks 디렉토리에서)
  const tasks = [];
  const tasksDir = join(process.env.HOME || process.env.USERPROFILE, '.claude', 'tasks');
  try {
    if (existsSync(tasksDir)) {
      const taskTeams = readdirSync(tasksDir);
      taskTeams.forEach(team => {
        const teamTaskDir = join(tasksDir, team);
        try {
          const files = readdirSync(teamTaskDir).filter(f => f.endsWith('.json'));
          files.forEach(f => {
            try {
              const task = JSON.parse(readFileSync(join(teamTaskDir, f), 'utf8'));
              tasks.push({
                id: task.id || f.replace('.json', ''),
                subject: task.subject || task.name || 'Unknown',
                status: task.status || 'pending',
                owner: task.owner || '',
                team,
              });
            } catch {}
          });
        } catch {}
      });
    }
  } catch (e) { /* no tasks */ }

  // 3. Git 상태
  const git = {};
  try {
    git.branch = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf8' }).trim();
    git.commits = execSync('git rev-list --count HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
    git.lastCommit = execSync('git log -1 --format=%s', { cwd: projectRoot, encoding: 'utf8' }).trim();
    git.lastTime = execSync('git log -1 --format=%cr', { cwd: projectRoot, encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf8' }).trim();
    git.dirty = dirty ? dirty.split('\n').length : 0;
  } catch (e) {
    git.error = e.message;
  }

  // 4. 프로젝트 에이전트 목록
  const projectAgents = [];
  const agentsDir = join(projectRoot, '.claude', 'agents');
  try {
    if (existsSync(agentsDir)) {
      readdirSync(agentsDir).filter(f => f.endsWith('.md')).forEach(f => {
        const name = f.replace('.md', '');
        const isActive = agents.some(a => a.name === name);
        projectAgents.push({
          name,
          status: isActive ? 'idle' : 'offline',
          task: null,
        });
      });
    }
  } catch {}

  // 활성 에이전트와 프로젝트 에이전트 병합 + 업무보고 반영
  const mergedAgents = projectAgents.map(pa => {
    const active = agents.find(a => a.name === pa.name);
    const latestReport = reports.find(r => r.agent === pa.name);
    const merged = active ? { ...pa, ...active } : pa;

    // 업무보고가 있으면 상태 업그레이드
    if (latestReport) {
      if (latestReport.status === 'success' && merged.status === 'offline') {
        merged.status = 'idle';
      }
      merged.lastAction = latestReport.action;
      merged.lastReport = latestReport.timestamp;
    }

    return merged;
  });

  res.json({
    agents: mergedAgents,
    tasks,
    git,
    timestamp: new Date().toISOString(),
  });
});

// 에이전트 업무보고 저장소
const reports = [];

// 에이전트 업무보고 등록
router.post('/report', (req, res) => {
  const { agent, action, status, detail, timestamp } = req.body;
  const report = {
    id: Date.now().toString(36),
    agent: agent || 'unknown',
    action: action || '',
    status: status || 'info', // info, success, warning, error
    detail: detail || '',
    timestamp: timestamp || new Date().toISOString(),
  };
  reports.unshift(report);
  if (reports.length > 100) reports.pop();
  res.status(201).json(report);
});

// 업무보고 목록 조회
router.get('/reports', (req, res) => {
  const { agent, limit = 50 } = req.query;
  let result = [...reports];
  if (agent) result = result.filter(r => r.agent === agent);
  res.json(result.slice(0, Number(limit)));
});

export default router;
