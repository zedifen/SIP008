# Cloudflare SIP008 Subscription Service

## API

### `/`

Serve `ui.html` as the basic UI. Provide a convenient funtionality of generating URL of converted subscription.

Takes original V2RayN subscription (URL encoded) as `link` parameter. Returns SIP008 subscription.

Example: `https://sip008.example.workers.dev/?link=https%3A%2F%2Fexample.com%2Flink%2F1234567`

### `/src.js`

Serve the source code of this Cloudflare Worker.

Note: For `/` (index.html) and `src.js` the worker fetches files real-time from the link provided in the script.

### `/get/`

Bind a KV storage to the worker and you can provide subscription for users.

KV examples:

| Key | Value |
| :--- | :--- |
| `user:henry` | `101,102,103` |
| `101` | `ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@127.0.0.1:8388/` |
| `102` | `ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@127.0.0.1:8389/?plugin=v2ray-plugin%3Btls%3Bhost%3Dgithub.com` |
| `103` | `ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@127.0.0.1:8390/?plugin=v2ray-plugin%3Btls%3Bhost%3Dgithub.com%3Bpath%3D123` |

Then the user `henry` can get their subscription at `https://sip008.example.workers.dev/?user=henry`.
