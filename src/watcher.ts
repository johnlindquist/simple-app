/* eslint-disable no-restricted-syntax */
/* eslint-disable jest/no-export */
/* eslint-disable import/prefer-default-export */
import log from 'electron-log';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';

import { appDbPath, info, kenvPath, kitPath, shortcutsPath } from './helpers';
import {
  unlinkShortcuts,
  updateMainShortcut,
  shortcutScriptChanged,
} from './shortcuts';

import { cancelSchedule, scheduleScriptChanged } from './schedule';
import { unlinkEvents, systemScriptChanged } from './system-events';
import { removeWatch, watchScriptChanged } from './watch';
import { backgroundScriptChanged, removeBackground } from './background';
import { emitter, KitEvent } from './events';
import { updateScripts } from './state';
import { processes } from './process';
import { ProcessType } from './enums';

const onScriptsChanged = async (
  event: 'add' | 'change' | 'unlink',
  filePath: string
) => {
  if (event === 'unlink') {
    unlinkShortcuts(filePath);
    cancelSchedule(filePath);
    unlinkEvents(filePath);
    removeWatch(filePath);
    removeBackground(filePath);
  }
  if (event === 'add' || event === 'change') {
    const script = await info(filePath);

    shortcutScriptChanged(script);
    scheduleScriptChanged(script);
    systemScriptChanged(script);
    watchScriptChanged(script);
    backgroundScriptChanged(script);
  }
};

export const onDbChanged = async (event: any, filePath: string) => {
  updateMainShortcut(filePath);
};

export const cacheMenu = async () => {
  processes.add(
    ProcessType.Background,
    kitPath('cli', 'refresh-scripts-db.js'),
    []
  );
  await updateScripts();
};

let watchers: FSWatcher[] = [];

export const setupWatchers = async () => {
  watchers = [];
  const shortcutsDbWatcher = chokidar.watch([shortcutsPath]);
  watchers.push(shortcutsDbWatcher);
  shortcutsDbWatcher.on('all', onDbChanged);

  // const kenvEnvWatcher = chokidar.watch([kenvPath('.env')]);
  // watchers.push(kenvEnvWatcher);

  // kenvEnvWatcher.on('all', () => {
  //   log.info(`🌳 ${kenvPath('.env')} changed. Restarting idle process.`);
  //   processes.resetIdlePromptProcess();
  // });

  const kenvScripts = `${kenvPath('scripts')}${path.sep}*.js`;
  const scriptsWatcher = chokidar.watch([kenvScripts], {
    depth: 0,
  });
  watchers.push(scriptsWatcher);

  const kitAppDbWatcher = chokidar.watch([appDbPath]);
  watchers.push(kitAppDbWatcher);

  kitAppDbWatcher.on('change', async () => {
    await cacheMenu();
  });

  scriptsWatcher.on('all', onScriptsChanged);

  scriptsWatcher.on('ready', async () => {
    await cacheMenu();

    scriptsWatcher.on('add', cacheMenu);
    scriptsWatcher.on('change', cacheMenu);
    scriptsWatcher.on('unlink', cacheMenu);
  });
};

export const resetWatchers = async () => {
  for await (const watcher of watchers) {
    await watcher.close();
  }

  await setupWatchers();
};

emitter.on(KitEvent.SetKenv, async () => {
  await resetWatchers();
});