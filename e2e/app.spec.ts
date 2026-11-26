import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'wpt_switchlab_enterprise_v3';
const device = (page: Page, name: string) => page.locator('#devices-layer .device', { hasText: name });

async function openCli(page: Page, name: string): Promise<void> {
  await device(page, name).click();
  await page.locator('#tab-btn-cli').click();
  await expect(page.locator('#cli-input')).toBeFocused();
}

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#cli-input').fill(cmd);
  await page.locator('#cli-input').press('Enter');
}

async function savedTopology(page: Page): Promise<{ devices: { name: string }[] }> {
  await page.locator('[data-action="topology.save"]').click();
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return JSON.parse(raw ?? '{}') as { devices: { name: string }[] };
}

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'data:')
      errors.push(`external request: ${req.url()}`);
  });
  await page.goto('/');
  await expect(page.locator('#devices-layer .device')).toHaveCount(5);
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('boots the default lab offline under a strict CSP', async ({ page }) => {
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  await expect(page.locator('#cables-layer .link-group')).toHaveCount(4);
  await expect(page.locator('#zoom-level')).toHaveText('100%');
});

test('pings across the switch from the host CLI', async ({ page }) => {
  await openCli(page, 'Host-01');
  await run(page, 'ping 192.168.1.100');
  await expect(page.locator('#cli-output')).toContainText('4 packets transmitted, 4 received, 0% packet loss', {
    timeout: 20_000,
  });
  await expect(page.locator('#pdu-list')).toContainText('ICMP Echo');
});

test('accepts IOS abbreviations on the router', async ({ page }) => {
  await openCli(page, 'R1-Core');
  for (const cmd of ['en', 'conf t', 'int gi0/1']) await run(page, cmd);
  await expect(page.locator('#cli-prompt')).toHaveText('R1-Core(config-if)#');
  await run(page, 'end');
  await run(page, 'sh ip int br');
  await expect(page.locator('#cli-output')).toContainText('192.168.1.1');
});

test('leases an address from the DHCP lab server', async ({ page }) => {
  await page.locator('#preset-selector').selectOption('dhcp_lab');
  await expect(page.locator('#devices-layer .device')).toHaveCount(4);
  await device(page, 'Estacao-1').click({ button: 'right' });
  await page.locator('#ctx-btn-dhcp').click();
  await expect(device(page, 'Estacao-1').locator('.device-ip-label')).toHaveText('10.10.0.100', { timeout: 10_000 });
});

test('places a device and undoes and redoes it', async ({ page }) => {
  await page.locator('#cat-end_devices').click();
  await page.locator('.equipment-item[data-item="pc"]').click();
  await page.locator('#workspace').click({ position: { x: 160, y: 160 } });
  await expect(page.locator('#devices-layer .device')).toHaveCount(6);
  await page.locator('#btn-undo').click();
  await expect(page.locator('#devices-layer .device')).toHaveCount(5);
  await page.locator('#btn-redo').click();
  await expect(page.locator('#devices-layer .device')).toHaveCount(6);
});

test('renders hostile names from an imported file as inert text', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=1">';
  const topology = await savedTopology(page);
  topology.devices[0]!.name = payload;
  await page.locator('#import-file-input').setInputFiles({
    name: 'hostile.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(topology)),
  });
  await expect(device(page, payload)).toHaveCount(1);
  await expect(page.locator('#devices-layer img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test('rejects a corrupt import without touching the workspace', async ({ page }) => {
  await page.locator('#import-file-input').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ devices: [{ id: 'x', typeStr: 'toaster' }], links: [] })),
  });
  await expect(page.locator('#toast-container')).toContainText('Arquivo JSON inválido');
  await expect(page.locator('#devices-layer .device')).toHaveCount(5);
});

test('restores a saved topology from local storage', async ({ page }) => {
  await savedTopology(page);
  await page.locator('#preset-selector').selectOption('mesh_wan');
  await expect(device(page, 'R-SP')).toHaveCount(1);
  await page.locator('[data-action="topology.load"]').click();
  await page.locator('#modal-confirm-btn').click();
  await expect(device(page, 'Host-01')).toHaveCount(1);
  await expect(page.locator('#devices-layer .device')).toHaveCount(5);
});
