# Veo Video for n8n: first video

Generate one Veo video, then query the same task until it finishes. This community package connects only the Veo Video service through Ace Data Cloud. The screenshots below show an actual self-hosted n8n 2.42.3 instance in English. n8n Creator Portal verification is pending.

**Package:** `@acedatacloud/n8n-nodes-veo-video` · [Veo Video API and pricing](https://platform.acedata.cloud/documents/veo-videos) · [Source](https://github.com/AceDataCloud/VeoN8N)

## Quick start

### 1. Install the node

In self-hosted n8n, sign in as an owner or admin. Open **Settings → Community nodes → Install**, enter `@acedatacloud/n8n-nodes-veo-video`, review the author **Ace Data Cloud**, accept the installation notice and select **Install**. Your server needs HTTPS access to npm and `api.acedata.cloud`. [n8n's installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/) covers prerequisites. n8n Cloud exposes a community node in its picker only after verification.

![Veo Video in the local n8n node picker](https://raw.githubusercontent.com/AceDataCloud/VeoN8N/main/_assets/tutorial/01-node-picker.png)

### 2. Get an API key with Veo access

1. Sign in at [Ace Data Cloud → Applications](https://platform.acedata.cloud/console/applications).
2. Open **General application** and copy its API key, or choose **Manage Keys → Create** for a separate n8n key.
3. Check Veo access, current pricing and balance. If **Allowed APIs** is enabled, include both `/veo/videos` and `/veo/tasks`.

![Copy a key or open Manage Keys](https://raw.githubusercontent.com/AceDataCloud/VeoDify/bc7cdc93e333281d5e9f075d6d9431accfebfde3/_assets/tutorial/get-api-key-en.png)

![Create a separate key](https://raw.githubusercontent.com/AceDataCloud/VeoDify/bc7cdc93e333281d5e9f075d6d9431accfebfde3/_assets/tutorial/create-api-key-en.png)

Copy only the application token. Do not include `Bearer `, quotation marks or a platform management token. Keep it out of workflow exports and screenshots.

### 3. Save the credential in n8n

Add **Veo Video by Ace Data Cloud** to a workflow. In **Credential**, choose **Connect to Veo Video by Ace Data Cloud** and create a new credential. Paste the token into **API Token**. Set **Allowed HTTP Request Domains** to **Specific Domains → `api.acedata.cloud`** and save. Use the same credential on **Create** and **Get Task**.

The credential test calls the free `/openai/models` metadata route. It checks the token, while the first Veo call checks service access.

![Veo Video credential form in n8n](https://raw.githubusercontent.com/AceDataCloud/VeoN8N/main/_assets/tutorial/02-credential.png)

### 4. Import and run the smallest workflow

[Download the credential-free quickstart](https://github.com/AceDataCloud/VeoN8N/raw/refs/heads/main/examples/quickstart.json). In a new n8n workflow, choose **⋯ → Import → From file** and assign your credential to both Veo Video nodes. The path is **Start → Create → Wait 30 Seconds → Get Task**.

![Imported Veo Video workflow in n8n 2.42.3](https://raw.githubusercontent.com/AceDataCloud/VeoN8N/main/_assets/tutorial/03-workflow.png)

| Create field | First-run value |
| --- | --- |
| Resource / Operation | Video / Create |
| Model | Veo 3.1 Fast |
| Image URLs | Empty |
| Resolution | Default |

Prompt: `A white ceramic mug on a cream tabletop, gentle camera orbit, no text. n8n validation.`

Check the current Veo 3.1 Fast price and account balance before executing. Keep **Retry On Fail** off and select **Execute workflow** once. Create sets `action=text2video` and `async=true`, returning `taskId` with status `submitted`. That acknowledgment is not a completed video. **Get Task** points to **Create → taskId**, so it queries the same task after the wait.

![Veo Video creation settings](https://raw.githubusercontent.com/AceDataCloud/VeoN8N/main/_assets/tutorial/04-configure.png)

### 5. Confirm the result and charge

Open **Get Task** output. Continue only when `status=succeeded`, `finished=true` and `successful=true`; then open `videoUrls`. If the task is still processing, **do not rerun the full workflow**: it would create another paid video. Use the [query-only workflow](https://github.com/AceDataCloud/VeoN8N/raw/refs/heads/main/examples/query-existing-task.json) with the original task ID. The [bounded polling workflow](https://github.com/AceDataCloud/VeoN8N/raw/refs/heads/main/examples/generate-and-wait.json) queries that ID for up to 30 minutes without creating another task.

Compare the task's trace ID and execution time with [Ace Data Cloud usage history](https://platform.acedata.cloud/console). Any `cost.amount` is in **Credits**, not USD. Price depends on the current model and your account package. A previous Veo 3.1 Fast video succeeded in Dify and deducted `0.648 Credits` under that test account; it is not a call made by this n8n package. A credentialed n8n result and bill have not yet been verified for this release.

## Other options and troubleshooting

With one or two public HTTPS images, Create uses `image2video` and can set 16:9 or 9:16. Veo 3.1 Fast Ingredients requires one to three images and uses `ingredients2video`; it does not support text-only generation. A 4K output is limited to Veo 3.1 models. Other actions such as extension and reshoot are not in this first package release. Advanced combinations have contract tests, not claimed live n8n success. **Task → Get Many** queries up to 50 existing IDs without generation.

| What you see | What to check |
| --- | --- |
| 401 or 403 | Check the full application token, expiry, Veo access, balance and Allowed APIs for both endpoints. |
| 400 | Check model and image-count rules; keep the first run on Veo 3.1 Fast with no images. |
| submitted or processing | Query the same task ID. Do not rerun Create to poll. |
| 429 | Reduce concurrency and keep automatic retries off. |
| Timeout or 5xx | Inspect the original task and usage history before submitting again; the first request may have been accepted. |
| Video link fails | Wait for terminal success, then open the returned URL directly. |

Each input item can create one paid task. The node does not automatically retry or follow HTTP redirects, and task output omits known credential, request and internal routing fields. Process only media you are authorized to use. [Privacy](https://github.com/AceDataCloud/VeoN8N/blob/main/PRIVACY.md) · [Report an issue](https://github.com/AceDataCloud/VeoN8N/issues) · dev@acedata.cloud
