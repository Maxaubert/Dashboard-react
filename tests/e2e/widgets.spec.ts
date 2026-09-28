import { test, expect, type Page } from '@playwright/test';
import { existingHome, mockWidgetDashboard } from './widgets.fixture';

test.beforeEach(async ({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== 'widgets-mocked', 'Use tests/e2e/widgets.config.ts for isolated mock data.');
});

function widgets(page: Page) {
  return page.getByRole('region', { name: 'Widgets', exact: true });
}

function widgetCard(page: Page, name: string) {
  return widgets(page).getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function addWidget(page: Page, name: string) {
  await widgets(page).getByRole('button', { name: 'Legg til widget', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Legg til widget', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) }).click();
}

async function addHabit(page: Page, name = 'Gå en tur') {
  await addWidget(page, 'Vanesporing');
  await page.getByLabel('Navn på vane', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Legg til vane', exact: true }).click();
  await expect(widgetCard(page, name)).toBeVisible();
}

test('existing stored habits reappear and survive unrelated settings changes', async ({ page }) => {
  const habit = { id: 'legacy-habit', name: 'Les hver dag', color: '#9fd07a', completedDays: ['2026-09-20'], createdAt: '2026-09-01T12:00:00Z' };
  const savedWidgets = [{ id: 'legacy-widget', type: 'habit', refId: habit.id }];
  const store = await mockWidgetDashboard(page, { ...existingHome, widgets: savedWidgets, habits: [habit] });
  await page.goto('/');
  await expect(widgetCard(page, habit.name)).toBeVisible();
  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Innstillinger', exact: true });
  await settings.getByRole('switch', { name: 'Gjøremål', exact: true }).click();
  await expect.poll(() => store.writes.length).toBe(1);
  expect(store.saved().habits).toEqual([habit]);
  expect(store.saved().widgets).toEqual(savedWidgets);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(widgetCard(page, habit.name)).toBeVisible();
});

test('habit creation, completion and visibility persist through reloads', async ({ page }) => {
  const store = await mockWidgetDashboard(page);
  await page.goto('/');
  await expect(widgets(page)).toBeVisible();
  await addHabit(page);
  await widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Fullfør i dag', exact: true }).click();
  await expect(widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Angre i dag', exact: true })).toBeVisible();
  await expect.poll(() => store.writes.length).toBeGreaterThanOrEqual(2);
  await page.reload();
  await expect(widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Angre i dag', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  let settings = page.getByRole('dialog', { name: 'Innstillinger', exact: true });
  await settings.getByRole('switch', { name: 'Widgets', exact: true }).click();
  await expect.poll(() => store.saved().hidden).toContain('widgets');
  await page.keyboard.press('Escape');
  await expect(widgets(page)).toHaveCount(0);
  await page.reload();
  await expect(widgets(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  settings = page.getByRole('dialog', { name: 'Innstillinger', exact: true });
  await expect(settings.getByRole('switch', { name: 'Widgets', exact: true })).toHaveAttribute('aria-checked', 'false');
  await settings.getByRole('switch', { name: 'Widgets', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Angre i dag', exact: true })).toBeVisible();
  await widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Angre i dag', exact: true }).click();
  await expect(widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Fullfør i dag', exact: true })).toBeVisible();
});

test('failed habit save shows feedback, rolls back and can be retried', async ({ page }) => {
  const store = await mockWidgetDashboard(page);
  await page.goto('/');
  await addHabit(page);
  await expect.poll(() => store.writes.length).toBe(1);
  const original = structuredClone(store.saved());
  let failedOnce = false;
  await page.route('**/rest/v1/documents*', async (route) => {
    if (!failedOnce && route.request().method() === 'POST') {
      failedOnce = true;
      await route.fulfill({ status: 500, json: { message: 'Simulated save failure' } });
    } else {
      await route.fallback();
    }
  });
  const habit = widgetCard(page, 'Gå en tur');
  await habit.getByRole('button', { name: 'Fullfør i dag', exact: true }).click();
  await expect(page.getByText('Kunne ikke lagre endringen', { exact: true })).toBeVisible();
  await expect(habit.getByRole('button', { name: 'Fullfør i dag', exact: true })).toBeVisible();
  expect(store.saved()).toEqual(original);
  await habit.getByRole('button', { name: 'Fullfør i dag', exact: true }).click();
  await expect.poll(() => store.writes.length).toBe(2);
  await expect(habit.getByRole('button', { name: 'Angre i dag', exact: true })).toBeVisible();
  await page.reload();
  await expect(habit.getByRole('button', { name: 'Angre i dag', exact: true })).toBeVisible();
});

test('Pomodoro and stopwatch start, pause and reset independently', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Pomodoro');
  await addWidget(page, 'Stoppeklokke');
  const pomodoro = widgetCard(page, 'Pomodoro');
  const stopwatch = widgetCard(page, 'Stoppeklokke');
  await expect(pomodoro.getByText('25:00', { exact: true })).toBeVisible();
  await pomodoro.getByRole('button', { name: 'Start', exact: true }).click();
  await stopwatch.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(65_000);
  await expect(pomodoro.getByRole('timer', { name: 'Pomodoro' })).toHaveText(/^23:5\d$/);
  await expect(stopwatch.getByRole('timer', { name: 'Stoppeklokke' })).toHaveText(/^01:0\d$/);
  await expect(pomodoro.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(stopwatch.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await pomodoro.getByRole('button', { name: 'Pause', exact: true }).click();
  await stopwatch.getByRole('button', { name: 'Pause', exact: true }).click();
  const pausedPomodoro = await pomodoro.innerText();
  const pausedStopwatch = await stopwatch.innerText();
  await page.clock.fastForward(10_000);
  await expect(pomodoro).toHaveText(pausedPomodoro, { useInnerText: true });
  await expect(stopwatch).toHaveText(pausedStopwatch, { useInnerText: true });
  await pomodoro.getByRole('button', { name: 'Nullstill', exact: true }).click();
  await stopwatch.getByRole('button', { name: 'Nullstill', exact: true }).click();
  await expect(pomodoro.getByText('25:00', { exact: true })).toBeVisible();
  await expect(stopwatch.getByRole('timer', { name: 'Stoppeklokke' })).toHaveText('00:00');
  await expect(pomodoro.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await expect(stopwatch.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('countdown alerts remain dismissible while widgets are hidden and alarm time is configurable', async ({ page }) => {
  const store = await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Alarm');
  const alarm = widgetCard(page, 'Alarm');
  await alarm.getByRole('button', { name: 'Tilpass alarm', exact: true }).click();
  let settings = page.getByRole('dialog', { name: 'Tilpass alarm', exact: true });
  await settings.getByLabel('Klokkeslett', { exact: true }).fill('08:30');
  await settings.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(alarm.getByRole('timer', { name: 'Alarm' })).toHaveText('08:30');
  await alarm.getByRole('button', { name: 'Aktiver', exact: true }).click();
  await expect(alarm.getByRole('button', { name: 'Tilpass alarm', exact: true })).toBeDisabled();
  await alarm.getByRole('button', { name: 'Deaktiver', exact: true }).click();
  await expect(alarm.getByRole('button', { name: 'Aktiver', exact: true })).toBeVisible();

  await addWidget(page, 'Nedtelling');
  const countdown = widgetCard(page, 'Nedtelling');
  await countdown.getByRole('button', { name: 'Tilpass nedtelling', exact: true }).click();
  settings = page.getByRole('dialog', { name: 'Tilpass nedtelling', exact: true });
  await settings.getByLabel('Minutter', { exact: true }).fill('1');
  await settings.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:00');
  await countdown.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  settings = page.getByRole('dialog', { name: 'Innstillinger', exact: true });
  await settings.getByRole('switch', { name: 'Widgets', exact: true }).click();
  await expect.poll(() => store.saved().hidden).toContain('widgets');
  await page.keyboard.press('Escape');
  await page.clock.fastForward(61_000);
  await expect(widgets(page)).toHaveCount(0);
  const alert = page.getByRole('status').filter({ hasText: 'Nedtellingen er ferdig' });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Stopp lyd', exact: true }).click();
  await expect(alert).toHaveCount(0);
});

test('timer completion can be stopped above an open settings dialog', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Nedtelling');
  const countdown = widgetCard(page, 'Nedtelling');
  await countdown.getByRole('button', { name: 'Tilpass nedtelling', exact: true }).click();
  const timerSettings = page.getByRole('dialog', { name: 'Tilpass nedtelling', exact: true });
  await timerSettings.getByLabel('Minutter', { exact: true }).fill('1');
  await timerSettings.getByRole('button', { name: 'Lagre', exact: true }).click();
  await countdown.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  await page.clock.fastForward(61_000);
  const completion = page.getByRole('dialog', { name: 'Timer ferdig', exact: true });
  await expect(completion).toBeVisible();
  await expect(completion.getByText('Nedtellingen er ferdig', { exact: true })).toBeVisible();
  await completion.getByRole('button', { name: 'Stopp lyd', exact: true }).click();
  await expect(completion).toHaveCount(0);
  const settings = page.getByRole('dialog', { name: 'Innstillinger', exact: true });
  await expect(settings).toBeVisible();
  const widgetSwitch = settings.getByRole('switch', { name: 'Widgets', exact: true });
  await widgetSwitch.click();
  await expect(widgetSwitch).toHaveAttribute('aria-checked', 'false');
  await widgetSwitch.click();
  await expect(widgetSwitch).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:00');
});

test('countdown clock supports seconds, cancel, reload and a draining ring', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Nedtelling');
  const countdown = widgetCard(page, 'Nedtelling');
  await countdown.getByRole('button', { name: 'Endre tid for nedtelling', exact: true }).click();
  let editor = countdown.getByRole('textbox', { name: 'Rediger varighet', exact: true });
  await editor.fill('1:30');
  await editor.press('Enter');
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:30');
  await expect(countdown.getByRole('button', { name: 'Endre tid for nedtelling', exact: true })).toBeFocused();
  await countdown.getByRole('button', { name: 'Endre tid for nedtelling', exact: true }).click();
  editor = countdown.getByRole('textbox', { name: 'Rediger varighet', exact: true });
  await editor.fill('9:45');
  await editor.press('Escape');
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:30');
  await expect(countdown.getByRole('button', { name: 'Endre tid for nedtelling', exact: true })).toBeFocused();
  await page.reload();
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:30');

  const arc = countdown.locator('.tt-ring circle').last();
  const originalOffset = await arc.evaluate((element) => Number.parseFloat(getComputedStyle(element).strokeDashoffset));
  await countdown.getByRole('button', { name: 'Endre tid for nedtelling', exact: true }).click();
  await countdown.getByRole('textbox', { name: 'Rediger varighet', exact: true }).fill('invalid');
  await expect(countdown.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await expect(countdown.getByRole('textbox', { name: 'Rediger varighet', exact: true })).toHaveValue('invalid');
  await expect(countdown.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await countdown.getByRole('textbox', { name: 'Rediger varighet', exact: true }).press('Escape');
  await countdown.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(30_000);
  await countdown.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText(/^(?:01:00|00:5\d)$/);
  await expect.poll(() => arc.evaluate((element) => Number.parseFloat(getComputedStyle(element).strokeDashoffset))).toBeGreaterThan(originalOffset);

  await countdown.getByRole('button', { name: 'Nedtelling', exact: true }).click();
  const expanded = page.getByRole('dialog', { name: 'Tilpass nedtelling', exact: true });
  await expect(expanded).toBeVisible();
  await expanded.getByRole('button', { name: 'Endre tid for nedtelling', exact: true }).click();
  editor = expanded.getByRole('textbox', { name: 'Rediger varighet', exact: true });
  await editor.fill('3:15');
  await editor.press('Escape');
  await expect(expanded).toBeVisible();
  await expect(expanded.getByRole('button', { name: 'Endre tid for nedtelling', exact: true })).toBeFocused();
  await expect(expanded.getByRole('timer', { name: 'Nedtelling' })).toHaveText(/^(?:01:00|00:5\d)$/);
  await page.screenshot({ path: test.info().outputPath('widgets-expanded-countdown.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await expanded.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('widgets-expanded-countdown-mobile.png'), fullPage: true });
});

test('typing inserts colons and Start uses the edited duration without Enter', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Nedtelling');
  const countdown = widgetCard(page, 'Nedtelling');
  await countdown.getByRole('button', { name: 'Nedtelling', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tilpass nedtelling', exact: true });
  const clock = dialog.getByRole('button', { name: 'Endre tid for nedtelling', exact: true });
  const resting = await clock.boundingBox();
  const restingFont = await clock.evaluate((element) => getComputedStyle(element).fontSize);
  await clock.click();
  const editor = dialog.getByRole('textbox', { name: 'Rediger varighet', exact: true });
  const editing = await editor.boundingBox();
  expect(editing!.width).toBeCloseTo(resting!.width, 0);
  expect(editing!.height).toBeCloseTo(resting!.height, 0);
  expect(await editor.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.fontSize, style.borderTopWidth, style.outlineStyle, style.boxShadow, style.backgroundColor];
  })).toEqual([restingFont, '0px', 'none', 'none', 'rgba(0, 0, 0, 0)']);
  await editor.pressSequentially('01');
  await expect(editor).toHaveValue('01:');
  await editor.press('Backspace');
  await expect(editor).toHaveValue('01');
  await editor.press('ControlOrMeta+A');
  await editor.pressSequentially('0130');
  await expect(editor).toHaveValue('01:30');
  await editor.press('ControlOrMeta+A');
  await editor.pressSequentially('01:30');
  await expect(editor).toHaveValue('01:30');
  await page.screenshot({ path: test.info().outputPath('timer-clean-edit.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(dialog.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:30');
  await page.clock.fastForward(10_000);
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(dialog.getByRole('timer', { name: 'Nedtelling' })).toHaveText(/^01:[12]\d$/);
  await dialog.getByRole('button', { name: 'Nullstill', exact: true }).click();
  await expect(dialog.getByRole('timer', { name: 'Nedtelling' })).toHaveText('01:30');
  await page.keyboard.press('Escape');
  await addWidget(page, 'Alarm');
  const alarm = widgetCard(page, 'Alarm');
  await alarm.getByRole('button', { name: 'Endre tid for alarm', exact: true }).click();
  const alarmEditor = alarm.getByRole('textbox', { name: 'Rediger klokkeslett', exact: true });
  await alarmEditor.pressSequentially('08:30');
  await expect(alarmEditor).toHaveValue('08:30');
  await alarm.getByRole('button', { name: 'Aktiver', exact: true }).click();
  await expect(alarm.getByRole('timer', { name: 'Alarm' })).toHaveText('08:30');
  await expect(alarm.getByRole('button', { name: 'Deaktiver', exact: true })).toBeVisible();
});

test('clock selection is visible and invalid durations cannot start the previous time', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Nedtelling');
  const countdown = widgetCard(page, 'Nedtelling');
  await countdown.getByRole('button', { name: 'Nedtelling', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tilpass nedtelling', exact: true });
  const clock = dialog.getByRole('button', { name: 'Endre tid for nedtelling', exact: true });
  await clock.click();
  const editor = dialog.getByRole('textbox', { name: 'Rediger varighet', exact: true });
  const selection = () => editor.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd]);
  await expect.poll(selection).toEqual([0, 5]);
  await editor.press('ArrowRight');
  await editor.press('ControlOrMeta+A');
  await expect.poll(selection).toEqual([0, 5]);
  await editor.press('ArrowLeft');
  await editor.click();
  await expect.poll(selection).toEqual([0, 5]);
  const highlight = await editor.evaluate((element) => {
    const style = getComputedStyle(element, '::selection');
    return { background: style.backgroundColor, text: style.color };
  });
  expect(highlight).toEqual({ background: 'rgb(217, 227, 200)', text: 'rgb(28, 37, 24)' });
  await page.screenshot({ path: test.info().outputPath('timer-selected-text.png'), fullPage: true });

  await editor.pressSequentially('9999');
  await expect(editor).toHaveValue('99:99');
  await dialog.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(dialog.getByRole('timer', { name: 'Nedtelling' })).toHaveText('1:40:39');
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click();
  await dialog.getByRole('button', { name: 'Nullstill', exact: true }).click();
  await expect(dialog.getByRole('timer', { name: 'Nedtelling' })).toHaveText('1:40:39');
  await page.reload();
  await expect(countdown.getByRole('timer', { name: 'Nedtelling' })).toHaveText('1:40:39');
  await countdown.getByRole('button', { name: 'Nedtelling', exact: true }).click();
  await clock.click();
  await editor.fill('88:30:30');
  await editor.press('Enter');
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  await expect(editor).toHaveValue('88:30:30');
  await expect(dialog.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await expect(editor).toHaveValue('88:30:30');
  const error = dialog.getByRole('alert');
  await expect(error).toBeVisible();
  expect(await dialog.locator('.tt-ring-wrap').getByRole('alert').count()).toBe(0);
  const ringBox = await dialog.locator('.tt-ring-wrap').boundingBox();
  const errorBox = await error.boundingBox();
  expect(ringBox).not.toBeNull();
  expect(errorBox).not.toBeNull();
  const overlapWidth = Math.max(0, Math.min(ringBox!.x + ringBox!.width, errorBox!.x + errorBox!.width) - Math.max(ringBox!.x, errorBox!.x));
  const overlapHeight = Math.max(0, Math.min(ringBox!.y + ringBox!.height, errorBox!.y + errorBox!.height) - Math.max(ringBox!.y, errorBox!.y));
  expect(overlapWidth * overlapHeight).toBe(0);
  await page.screenshot({ path: test.info().outputPath('timer-validation-outside-ring.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('timer-validation-mobile.png'), fullPage: true });
});

test('Pomodoro settings update segmented progress and stopwatch records laps', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.clock.install();
  await page.goto('/');
  await addWidget(page, 'Pomodoro');
  const pomodoro = widgetCard(page, 'Pomodoro');
  await pomodoro.getByRole('button', { name: 'Pomodoro', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Tilpass pomodoro', exact: true });
  await settings.getByLabel('Fokus (minutter)', { exact: true }).fill('2');
  await settings.getByLabel('Pause (minutter)', { exact: true }).fill('1');
  await settings.getByLabel('Antall økter', { exact: true }).fill('2');
  await settings.getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(pomodoro.getByRole('timer', { name: 'Pomodoro' })).toHaveText('02:00');
  const ring = pomodoro.locator('.tt-ring');
  await expect(ring).toBeVisible();
  const originalSegments = await ring.locator('circle').evaluateAll((circles) => circles.map((circle) => getComputedStyle(circle).strokeDasharray));
  await pomodoro.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(65_000);
  await pomodoro.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(pomodoro.getByRole('timer', { name: 'Pomodoro' })).toHaveText(/^00:5\d$/);
  await expect.poll(() => ring.locator('circle').evaluateAll((circles) => circles.map((circle) => getComputedStyle(circle).strokeDasharray))).not.toEqual(originalSegments);

  await addWidget(page, 'Stoppeklokke');
  const stopwatch = widgetCard(page, 'Stoppeklokke');
  await stopwatch.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(10_000);
  await stopwatch.getByRole('button', { name: 'Runde', exact: true }).click();
  await page.clock.fastForward(5_000);
  await stopwatch.getByRole('button', { name: 'Runde', exact: true }).click();
  await stopwatch.getByRole('button', { name: 'Pause', exact: true }).click();
  await stopwatch.getByRole('button', { name: 'Stoppeklokke', exact: true }).click();
  const expanded = page.getByRole('dialog', { name: 'Tilpass stoppeklokke', exact: true });
  await expect(expanded.getByRole('list', { name: 'Rundetider' }).getByRole('listitem')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('widgets-expanded-stopwatch.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.reload();
  await stopwatch.getByRole('button', { name: 'Stoppeklokke', exact: true }).click();
  await expect(expanded.getByRole('list', { name: 'Rundetider' }).getByRole('listitem')).toHaveCount(2);
});

test('widget cards and chooser fit desktop, mobile and zoom layout', async ({ page }) => {
  await mockWidgetDashboard(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const todo = page.locator('.area-todo');
  const emptyBox = await widgets(page).boundingBox();
  const todoBox = await todo.boundingBox();
  expect(emptyBox).not.toBeNull();
  expect(todoBox).not.toBeNull();
  expect(Math.abs(emptyBox!.y - todoBox!.y)).toBeLessThan(2);
  expect(emptyBox!.x).toBeGreaterThan(todoBox!.x + todoBox!.width);
  expect(Math.abs(emptyBox!.width - todoBox!.width)).toBeLessThan(2);
  for (const [label, width, height] of [
    ['desktop', 1440, 1000], ['tablet', 921, 900], ['mobile', 390, 844], ['zoom-layout', 720, 500],
  ] as const) {
    await page.setViewportSize({ width, height });
    await widgets(page).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`widgets-empty-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const name of ['Pomodoro', 'Nedtelling', 'Stoppeklokke', 'Alarm']) await addWidget(page, name);
  await addHabit(page);
  await expect(widgets(page).getByRole('article')).toHaveCount(5);
  expect((await widgets(page).boundingBox())!.height).toBeLessThanOrEqual(320);

  for (const [label, width, height] of [
    ['desktop', 1440, 1000], ['tablet', 921, 900], ['mobile', 390, 844], ['zoom-layout', 720, 500],
  ] as const) {
    await page.setViewportSize({ width, height });
    await widgets(page).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(widgetCard(page, 'Gå en tur').getByRole('button', { name: 'Fullfør i dag', exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`widgets-${label}.png`), fullPage: true });
  }
  await widgets(page).getByRole('button', { name: 'Legg til widget', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Legg til widget', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('widgets-chooser.png'), fullPage: true });
});
