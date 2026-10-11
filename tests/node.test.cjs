const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VeoVideo, videoBody, taskResult } = require('../dist/nodes/VeoVideo/VeoVideo.node.js');
const { AceDataVeoVideoApi } = require('../dist/credentials/AceDataVeoVideoApi.credentials.js');

const base = {
  resource: 'video', operation: 'create', model: 'veo31-fast',
  prompt: 'A paper sphere rolls across a tabletop', imageUrls: '',
  aspectRatio: '16:9', resolution: 'default',
};
function body(parameters) { return videoBody(name => parameters[name] ?? ''); }
function context(parameters, responses = [], continueOnFail = false, credentials = { apiToken: 'test-token' }) {
  const calls = [];
  let next = 0;
  return {
    calls,
    getInputData: () => parameters.map(() => ({ json: {} })),
    getNode: () => ({ name: 'Veo Video', type: '@acedatacloud/n8n-nodes-veo-video.veoVideo', typeVersion: 1, position: [0, 0], parameters: {} }),
    getNodeParameter: (name, index, fallback) => parameters[index][name] ?? fallback,
    getCredentials: async () => credentials,
    continueOnFail: () => continueOnFail,
    helpers: { httpRequestWithAuthentication: async (credential, options) => {
      calls.push({ credential, ...options });
      const response = responses[next++];
      if (response instanceof Error) throw response;
      return response;
    } },
  };
}

const node = new VeoVideo();
test('one input submits one asynchronous video task with no retry', async () => {
  const ctx = context([base], [{ task_id: 'video-1', trace_id: 'trace-1', success: true }]);
  const [items] = await node.execute.call(ctx);
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0].credential, 'aceDataVeoVideoApi');
  assert.equal(ctx.calls[0].url, 'https://api.acedata.cloud/veo/videos');
  assert.equal(ctx.calls[0].method, 'POST');
  assert.equal(ctx.calls[0].disableFollowRedirect, true);
  assert.deepEqual(ctx.calls[0].body, {
    model: base.model, action: 'text2video', prompt: base.prompt, async: true,
  });
  assert.deepEqual(items[0], {
    json: { taskId: 'video-1', status: 'submitted', finished: false, successful: null, traceId: 'trace-1' },
    pairedItem: { item: 0 },
  });
});

test('invalid model and image combinations stop before a paid request', async () => {
  const bad = [
    { ...base, model: 'other' },
    { ...base, model: 'veo31-fast-ingredients', imageUrls: '' },
    { ...base, prompt: '' },
    { ...base, imageUrls: 'http://example.com/image.jpg' },
    { ...base, imageUrls: 'https://user:secret@example.com/image.jpg' },
    { ...base, imageUrls: 'https://example.com/a.jpg,https://example.com/b.jpg,https://example.com/c.jpg' },
    { ...base, aspectRatio: '2:1' }, { ...base, resolution: '8k' },
    { ...base, model: 'veo3-fast', resolution: '4k' },
  ];
  for (const parameters of bad) {
    const ctx = context([parameters]);
    await assert.rejects(node.execute.call(ctx));
    assert.equal(ctx.calls.length, 0);
  }
});

test('image and Ingredients modes use documented actions and image counts', () => {
  const image = body({ ...base, imageUrls: 'https://example.com/a.jpg,https://example.com/b.jpg' });
  assert.equal(image.action, 'image2video');
  assert.equal(image.aspect_ratio, '16:9');
  assert.deepEqual(image.image_urls, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  const ingredients = body({ ...base, model: 'veo31-fast-ingredients', imageUrls: 'https://example.com/a.jpg,https://example.com/b.jpg,https://example.com/c.jpg' });
  assert.equal(ingredients.action, 'ingredients2video');
  assert.equal(ingredients.aspect_ratio, undefined);
  assert.equal(ingredients.image_urls.length, 3);
});

test('Get queries the original task and exposes only completed media', async () => {
  const task = { id: 'video-1', finished_at: '2026-10-11T00:00:00Z',
    request: { prompt: 'private' }, credential_id: 'private',
    response: { success: true, trace_id: 'trace-1', data: [{ state: 'succeeded', video_url: 'https://example.com/video.mp4', supplier: 'private' }] } };
  const ctx = context([{ resource: 'task', operation: 'get', taskId: 'video-1' }], [task]);
  const [items] = await node.execute.call(ctx);
  assert.deepEqual(ctx.calls[0].body, { action: 'retrieve', id: 'video-1' });
  assert.equal(items[0].json.status, 'succeeded');
  assert.deepEqual(items[0].json.videoUrls, ['https://example.com/video.mp4']);
  assert.equal(items[0].json.data[0].supplier, undefined);
  assert.equal(items[0].json.taskId, 'video-1');
});

test('pending is not complete; failed task does not expose media', () => {
  const pending = taskResult({ id: 'video-1', finished_at: null, response: { success: true, data: [{ state: 'pending' }] } });
  assert.equal(pending.status, 'processing');
  assert.equal(pending.finished, false);
  assert.deepEqual(pending.videoUrls, []);
  const failed = taskResult({ id: 'video-2', finished_at: 'now', response: { success: false, data: [{ state: 'failed', video_url: 'https://example.com/bad.mp4' }] } });
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.videoUrls, []);
});

test('Get Many uses the task query endpoint without generation', async () => {
  const ctx = context([{ resource: 'task', operation: 'getMany', taskIds: 'video-1,video-2' }], [
    { items: [{ id: 'video-1', finished_at: null }, { id: 'video-2', finished_at: null }] },
  ]);
  const [items] = await node.execute.call(ctx);
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0].url, 'https://api.acedata.cloud/veo/tasks');
  assert.deepEqual(ctx.calls[0].body, { action: 'retrieve_batch', ids: ['video-1', 'video-2'] });
  assert.equal(items.length, 2);
});

test('uncertain transport failure never retries generation', async () => {
  const ctx = context([base, base], [new Error('connection lost'), { task_id: 'video-2' }], true);
  const [items] = await node.execute.call(ctx);
  assert.equal(ctx.calls.length, 2);
  assert.match(items[0].json.error, /request history/i);
  assert.equal(items[1].json.taskId, 'video-2');
});

test('credential is masked and tested on free metadata route', async () => {
  const credential = new AceDataVeoVideoApi();
  assert.equal(credential.properties[0].typeOptions.password, true);
  assert.match(credential.authenticate.properties.headers.Authorization, /Bearer/);
  assert.equal(credential.test.request.url, '/openai/models');
  const ctx = context([base], [], false, { apiToken: '' });
  await assert.rejects(node.execute.call(ctx), /credential is required/i);
  assert.equal(ctx.calls.length, 0);
});
