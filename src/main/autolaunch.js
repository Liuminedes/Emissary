// src/main/autolaunch.js
import AutoLaunch from 'auto-launch';
import { app } from 'electron';

const autoLauncher = new AutoLaunch({
  name: 'Emissary',
  path: app.getPath('exe'),
});

export async function applyAutoLaunch(enabled) {
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (enabled && !isEnabled) await autoLauncher.enable();
    if (!enabled && isEnabled) await autoLauncher.disable();
  } catch (err) {
    console.error('[AutoLaunch] Error:', err.message);
  }
}

export async function isAutoLaunchEnabled() {
  try {
    return await autoLauncher.isEnabled();
  } catch {
    return false;
  }
}
