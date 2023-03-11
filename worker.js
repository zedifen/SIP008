// Host the page html as-is and this script on some service like GitHub Gist.
// Then deploy this to Cloudflare Workers.
// Remember to set Environment Variables as below.

// pageUrl : https://gist.githubusercontent.com/{YOUR_USER_NAME}/{REPO_HASH}/raw/ui.html
// codeUrl : https://gist.githubusercontent.com/{YOUR_USER_NAME}/{REPO_HASH}/raw/worker.js

export default {
  async fetch(request, env) {
    return await handleRequest(request, env).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  }
}

function dumpToYaml(obj, depth=0, inArray) {
  const indent = '  ';
  let s = '';
  const isArray = Array.isArray(obj);
  for (const i in obj) {
    s += (inArray ? '' : indent.repeat(depth)) + (isArray ? '-' : `${i}:`);
    inArray = false;
    const val = obj[i];
    switch (typeof val) {
      case 'string':
        const l = val.split('\n');
        const d = '\n' + indent.repeat(depth + 1);
        s += l.length > 1 
          /*  |[  If there's spaces to be preserved in front of line     ][  ][          ] */
          ? ` |${l[0][0] === ' ' ? `${indent.length * (depth + 1)}-` : ''}${d}${l.join(d)}`    // Muiltiple lines
          : '`~!@#%&:,?\'"{}[]|-'.includes(val[0]) ? ` "${val.replaceAll('"', '\\"')}"` : ` ${val}`; // A single line
        s += '\n';
        break;
      case 'number':
      case 'boolean':
        s += ` ${val}`;
        s += '\n';
        break;
      default:
        s += isArray ? ' ' : '\n';
        s += dumpToYaml(val, depth + 1, isArray);
    }
  }
  return s;
}

function ssToSIP008(link, route) {
  const u = link.substring(5); // skip 'ss://'
  let p = u.split('#');
  const name = decodeURIComponent(p[1]);
  let l = p[0].split('@');
  let c = atob(l[0]).split(':');
  const method = c[0];
  const password = c[1];
  let s = l[1].split(':');
  let o = s[1].split('?');
  const address = s[0];
  const port = Number(o[0].split('/')[0]);
  const params = o[1];
  let obj = {
    'id': name,
    'remarks': name,
    'method': method,
    'password': password,
    'server': address,
    'server_port': port,
    'route': route,  // Shadowsocks Android feature
  }
  if (params != '' && params != null) {
    const q = 'plugin=';
    let opts = params.substring(params.indexOf(q) + q.length);
    opts = opts.substring(opts.indexOf('&'));
    opts = decodeURIComponent(opts);
    const i = opts.indexOf(';');
    obj['plugin'] = opts.substring(0, i);
    obj['plugin_opts'] = opts.substring(i + 1);
  }
  return obj;
}

function sip008toClash(obj) {
  const opts = {};
  for (const opt of obj['plugin_opts'].split(';')) {
    let l = opt.split('=');
    opts[l[0]] = (l.length > 1) ? l[1] : l[0];
  }
  let config = {
    'name': obj['remarks'],
    'type': 'ss',
    'server': obj['server'],
    'port': obj['server_port'],
    'cipher': obj['method'] === 'none' ? 'dummy' : obj['method'],
    'password': obj['password'],
  }
  if (obj['plugin']) {
    config['plugin'] = obj['plugin'],
    config['plugin-opts'] = {
      'mode': opts['mode'] || 'websocket',
      'tls': opts['tls'] === 'tls',
      'host': opts['host'],
      'path': opts['path'],
    };
  }
  return config;
}

function makeSIP008Sub(shareLinks, route) {
  let sub = {
    'version': 1,
    'servers': [],
  };
  const routeOptions = [  // Shadowsocks Android feature
    'all',
    'bypass-lan',
    'bypass-china',
    'bypass-lan-china',
    'gfwlist',
    'china-list',
    'custom-rules'
  ];
  const r = (routeOptions.includes(route) ? route : 'bypass-lan-china');
  shareLinks.forEach((link) => {
    if (link.startsWith('ss:')) {
      sub['servers'].push(ssToSIP008(link, r));
    }
  })
  return sub;
}

function makeClashSub(shareLinks) {
  let sub = {
    'port': 7890,
    'socks-port': 7891,
    'allow-lan': false,
    'proxies': [],
  };
  shareLinks.forEach((link) => {
    if (link.startsWith('ss:')) {
      sub['proxies'].push(sip008toClash(ssToSIP008(link)));
    }
  })
  return sub;
}

function isValidHttpUrl(s) {
  let url;
  try {
    url = new URL(s);
  } catch (err) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

async function handleRequest(request, {pageUrl, codeUrl, DB}) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const routeConvert = '/sip008'
  const routeGet = '/get'
  const routeCodeSrc = '/src.js'

  if (pathname === '/' || pathname.startsWith(routeConvert)) {
    const link = url.searchParams.get("link");
    const r = url.searchParams.get("route");
    if (link === null) {
      let ui;
      await fetch(pageUrl).then((r) => r.text()).then((t) => { ui = t; });
      return new Response(ui, {
        status: 200,
        headers: {
          "content-type": "text/html;charset=utf-8"
        }
      });
    } else {
      if (!isValidHttpUrl(link)) {
        return new Response("Link '" + link + "' is not valid.", { status: 400 })
      }
      let returnedContent;
      await fetch(link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
        }
      })
        .then((response) => response.text())
        .then((t) => {
          returnedContent = t;
        })
        .catch((err) => new Response(err.stack, { status: 500 }));
      let shareLinks;
      try {
        shareLinks = atob(returnedContent).split(/\r?\n/);
      } catch (err) {
        return new Response("Cannot parse content of the link.", { status: 400 });
      }
      return new Response(JSON.stringify(makeSIP008Sub(shareLinks, r)), {
        status: 200,
        headers: {
          "content-type": "application/json;charset=utf-8"
        }
      });
    }
  } else if (pathname.startsWith(routeGet)) {
    const u = url.searchParams.get("user");
    const t = url.searchParams.get("sub");
    const r = url.searchParams.get("route");
    if (u === null || u === '') {
      return new Response("Bad user.", { status: 400 });
    } else {
      let l = await DB.get('user:' + u);
      if (l === null) {
        return new Response("Bad user.", { status: 400 });
      } else {
        l = l.split(',');
        let s = [];
        for (let sId of l) {
          let url = await DB.get(sId);
          s.push(url);
        }
        switch (t) {
          case 'clash':
            return new Response(dumpToYaml(makeClashSub(s)), {
              status: 200,
              headers: {
                "content-type": "application/yaml;charset=utf-8"
              }
            });
            break;
          case 'ss':
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
    let code;
    await fetch(codeUrl).then((r) => r.text()).then((t) => { code = t; });
    return new Response(code, {
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
