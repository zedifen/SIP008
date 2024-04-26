// Host the page html as-is and this script on some service like GitHub Gist.
// Then deploy this to Cloudflare Workers.
// Remember to set Environment Variables as below.

import { sip008toClash, sip008toSs } from "./fromSIP008.ts";
import { makeClashSub, makeSIP008Sub, parseLinkToClashObject } from "./makeSub.ts";
import { SIP008Sub, ShadowsocksAndroidRouteOption, routeOptions } from "./types/shadowsocks.ts";
import { isValidHttpUrl } from "./utils/url.ts";
import { dumpToYaml } from "./utils/yaml.ts";

// remoteResourceRoot : https://gist.githubusercontent.com/{YOUR_USER_NAME}/{REPO_HASH}/raw/{ui.html|worker.js|clash.json}

export interface Env {
  remoteResourceRoot: string,
  DB: KVNamespace,
}

export default {
  async fetch(request: Request, env: Env) {
    return await handleRequest(request, env).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  }
}

async function handleRequest(request: Request, {remoteResourceRoot, DB}: Env) {
  const url = new URL(request.url);

  const subconvertPrefix = '/subconvert/';
  const pathname = url.pathname.startsWith(subconvertPrefix) ? url.pathname.slice(subconvertPrefix.length - 1) : url.pathname;

  const routeConvertFromV2RayN = '/fromV2RayN'
  const routeConvertFromSIP008 = '/fromSIP008'
  const routeGet = '/get'
  const routeCodeSrc = '/src.js'
  const routeClashTemplate = '/clash.json'

  const pageUrl = new URL('ui.html', remoteResourceRoot).toString();
  const codeUrl = new URL('worker.js', remoteResourceRoot).toString();
  const clashConfigUrl = new URL('clash.json', remoteResourceRoot).toString();

  const getValueOfKey = async function (sId: string) {
    if (sId === '' || sId === null) return null;
    return await DB.get(sId);
  };

  if (pathname === '/' || pathname.startsWith('/sip008') || pathname.startsWith(routeConvertFromV2RayN)) {
    const link = url.searchParams.get("link");
    const r = url.searchParams.get("route");
    if (link === null) {
      const {status, body} = await fetch(pageUrl);
      return new Response(body, {
        status,
        headers: {
          "content-type": "text/html;charset=utf-8"
        }
      });
    } else {
      if (!isValidHttpUrl(link)) {
        return new Response("Link '" + link + "' is not valid.", { status: 400 })
      }
      let returnedContent;
      try {
        const r = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
          }
        });
        returnedContent = await r.text();
      } catch (err) {
        return new Response(err.stack, { status: 500 });
      }
      let shareLinks;
      try {
        shareLinks = atob(returnedContent).split(/\r?\n/);
      } catch (_err) {
        return new Response("Cannot parse content of the link.", { status: 400 });
      }
      const s: {[i: string]: string} = {};
      for (let i = 0; i < shareLinks.length; i += 1) {
        if (shareLinks[i] == '') continue;
        s[i] = shareLinks[i];
      }
      const t = url.searchParams.get("sub");
      switch (t) {
        case 'v2rayn':
          return new Response(returnedContent, {
            status: 200,
            headers: {
              "content-type": "text/plain;charset=UTF-8"
            }
          });
        case 'clash':
          return new Response(dumpToYaml(await makeClashSub(Object.fromEntries(Object.entries(s).map(([k, v]) => { return [k, parseLinkToClashObject(v)] }).filter(([k, v]) => v)), [], clashConfigUrl)), {
            status: 200,
            headers: {
              "content-type": "application/yaml;charset=utf-8"
            }
          });
        case 'sip008':
        default:
          return new Response(JSON.stringify(makeSIP008Sub(s, r)), {
            status: 200,
            headers: {
              "content-type": "application/json;charset=utf-8"
            }
          });
      }
    }
  } else if (pathname.startsWith(routeConvertFromSIP008)) {
    const link = url.searchParams.get("link");
    const route = url.searchParams.get("route");
    if (!link || !isValidHttpUrl(link)) {
      return new Response(`Link '${link}' is not valid.`, { status: 400 })
    }
    try {
      const r = await fetch(link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
        }
      });
      const s: SIP008Sub = await r.json();
      switch (url.searchParams.get('sub')) {
        case 'v2rayn': {
          return new Response(btoa(s['servers'].map(sip008toSs).join('\r\n')), {
            status: 200,
            headers: {
              "content-type": "text/plain;charset=UTF-8"
            }
          });
        }
        case 'clash': {
          return new Response(dumpToYaml(await makeClashSub(Object.fromEntries(s['servers'].map((v, i) => [i.toString(), sip008toClash(v)]).filter(([_i, v]) => v)), [], clashConfigUrl)), {
            status: 200,
            headers: {
              "content-type": "application/yaml;charset=utf-8"
            }
          });
        }
        case 'sip008':
        default: {
          if (route && routeOptions.includes((route as ShadowsocksAndroidRouteOption)) && s['servers']) {
            for (const i of s['servers']) { i['route'] = (route as ShadowsocksAndroidRouteOption); }
          }
          return new Response(JSON.stringify(s), {
            status: 200,
            headers: {
              "content-type": "application/json;charset=utf-8"
            }
          });
        }
      }
    } catch (err) {
      return new Response(err.stack, { status: 400 });
    }
  } else if (pathname.startsWith(routeGet)) {
    const u = url.searchParams.get("user");
    const t = url.searchParams.get("sub");
    const r = url.searchParams.get("route");
    if (u === null || u === '') {
      return new Response("Bad user.", { status: 400 });
    } else {
      const n = await DB.get('user:' + u);
      if (n === null) {
        return new Response("Bad user.", { status: 400 });
      } else {
        const l = n.split(',');
        const s: {[i: string]: string} = {};
        const c = [];  // proxy chains
        for (const f of l) {
          const q = f.split(':').map(i => i.trim());
          if (q.length > 1) {
            c.push(q);
            for (const i of q) { 
              if (!s[i]) {
                const z = await getValueOfKey(i);
                if (z !== null && z !== '') s[i] = z;
              }
            }
          } else {
            const z = await getValueOfKey(q[0]);
            if (z !== null && z !== '') s[q[0]] = z;
          }
        }
        switch (t) {
          case 'v2rayn': {
            return new Response(btoa(Object.values(s).join('\r\n')), {
              status: 200,
              headers: {
                "content-type": "text/plain;charset=UTF-8"
              }
            });
          }
          case 'clash':
            return new Response(dumpToYaml(await makeClashSub(Object.fromEntries(Object.entries(s).map(([k, v]) => { return [k, parseLinkToClashObject(v)] }).filter(([k, v]) => v)), c, clashConfigUrl)), {
              status: 200,
              headers: {
                "content-type": "application/yaml;charset=utf-8"
              }
            });
          case 'sip008':
          default:
            return new Response(JSON.stringify(makeSIP008Sub(s, r)), {
              status: 200,
              headers: {
                "content-type": "application/json;charset=utf-8"
              }
            });
        }
      }
    }
  } else if (pathname == routeCodeSrc) {
    const {body, status} = await fetch(codeUrl);
    return new Response(body, {
      status,
      headers: {
        "content-type": "text/plain;charset=utf-8"
      }
    });
  } else if (pathname.startsWith(routeClashTemplate)) {
    const f = url.searchParams.get("format");
    const r = await fetch(clashConfigUrl);
    return new Response((f == 'yaml') ? dumpToYaml(JSON.parse((await r.text()))) : r.body, {
      status: 200,
      headers: {
        "content-type": "text/plain;charset=utf-8"
      }
    });
  } else {
    return new Response('Path not found.', {
      status: 404,
    });
  }
}
