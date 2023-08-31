// Host the page html as-is and this script on some service like GitHub Gist.
// Then deploy this to Cloudflare Workers.
// Remember to set Environment Variables as below.

// remoteResourceRoot : https://gist.githubusercontent.com/{YOUR_USER_NAME}/{REPO_HASH}/raw/{ui.html|worker.js|clash.json}

export default {
  async fetch(request, env) {
    return await handleRequest(request, env).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  }
}

function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

function fromBinary(encoded) {
  const bytes = base64ToBytes(encoded)
  let utf8decoder = new TextDecoder();
  return utf8decoder.decode(bytes);
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
    'remote_dns': '1.1.1.1',
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
  let config = {
    'name': obj['remarks'],
    'type': 'ss',
    'server': obj['server'],
    'port': obj['server_port'],
    'cipher': obj['method'] === 'none' ? 'dummy' : obj['method'],
    'password': obj['password'],
  }
  if (obj['plugin']) {
    const opts = {};
    for (const opt of obj['plugin_opts'].split(';')) {
      let l = opt.split('=');
      opts[l[0]] = (l.length > 1) ? l[1] : l[0];
    }
    if (opts['mode'] && opts['mode'] === 'quic') return null;
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

function vmessLinkToClash(link) {
  const d = JSON.parse(fromBinary(link.slice(8)));  // skip 'vmess://'
  let config = {
    name: d['ps'] || d['remark'] || 'vmess',
    type: 'vmess',
    server: d['add'],
    port: d['port'],
    uuid: d['id'],
    alterId: d['aid'] || 0,
    cipher: d['scy'] || 'auto',
    tls: d['tls'] === 'tls',
  };
  config['network'] = d['net'];
  switch (d['net']) {
    case 'ws':
      config['ws-opts'] = {
        path: d['path'],
        headers: {
          'Host': d['host'] || d['sni'],
        },
        'max-early-data': 2048,
        'early-data-header-name': 'Sec-WebSocket-Protocol',
      };
      break;
    case 'h2':
      config['tls'] = true,
      config['h2-opts'] = {
        host: [
          d['host'],
        ],
        path: d['path'],
      }
      break;
    case 'http':
      config['http-opts'] = {
        method: 'GET',
        path: [
          d['path'],
        ]
      }
      break;
  }
  return config;
}

function makeSIP008Sub(shareLinks, route) {
  let sub = {
    'version': 1,
    'servers': [],
    'clash': [],
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
  Object.entries(shareLinks).forEach(([i, link]) => {
    if (link.startsWith('ss:')) {
      sub['servers'].push(ssToSIP008(link, r));
    } else if (link.startsWith('vmess:')) {
      sub['clash'].push(vmessLinkToClash(link));
    }
  });
  return sub;
}

async function makeClashSub(shareLinks, chains, url) {
  let sub = {
    'port': 7890,
    'socks-port': 7891,
    'allow-lan': false,
    'mode': 'rule',
    'proxies': [],
    'proxy-groups': [],
  };
  try { 
    await fetch(url)
      .then(r => r.json())
      .then((d) => Object.entries(d).forEach(([k, v]) => {sub[k] = v}));
  } catch(err) {
    console.log(err);
  }
  const parseLink = (link) => {
    if (link.startsWith('ss:')) {
      return sip008toClash(ssToSIP008(link));
    } else if (link.startsWith('vmess:')) {
      return vmessLinkToClash(link);
    } else { return null; }
  }
  const s = new Set();
  const l = [];
  if (chains.length > 0) {
    for (const c of chains) {
      c.slice(0, c.length-1).forEach(i => s.add(i));
      sub['proxy-groups'].push({
        'name': 'Relay ' + c[c.length-1],
        'type': 'relay',
        'proxies': c,
      });
    }
    sub['proxy-groups'].push({  // forward group
      'name': 'Forward',
      'type': 'select',
      'proxies': [...s],
    });
  }
  Object.entries(shareLinks).forEach(([k, v]) => {
    const t = parseLink(v);
    if (!t) return;
    shareLinks[k] = t;
    sub['proxies'].push(t);
    if (!s.has(k)) { l.push(k); }
  });
  const DEFAULT_GROUP_NAME = 'Proxy';
  let defaultGroup = {  // default group
    'name': DEFAULT_GROUP_NAME,
    'type': 'select',
    'proxies': l,
  };
  sub['proxy-groups'].push(defaultGroup);
  sub['proxy-groups'].forEach(group => {
    group['proxies'] = group['proxies'].map(i => shareLinks[i]['name']);
  });
  sub['proxy-groups'].forEach(group => {
    if (group['type'] === 'relay') defaultGroup['proxies'].push(group['name']);
  });
  sub['proxy-groups'].push({
    'name': 'CHN',
    'type': 'select',
    'proxies': ['DIRECT', DEFAULT_GROUP_NAME],
  });
  sub['proxy-groups'].push({
    'name': 'Apple-CHN',
    'type': 'select',
    'proxies': ['DIRECT', DEFAULT_GROUP_NAME],
  });
  sub['proxy-groups'].push({
    'name': 'Google-CHN',
    'type': 'select',
    'proxies': ['DIRECT', DEFAULT_GROUP_NAME],
  });
  sub['proxy-groups'].push({
    'name': 'Telegram',
    'type': 'select',
    'proxies': [DEFAULT_GROUP_NAME, 'DIRECT'],
  });
  sub['proxy-groups'].push({
    'name': 'Final',
    'type': 'select',
    'proxies': [DEFAULT_GROUP_NAME, 'DIRECT'],
  });
  let rules = [];
  await fetch('https://core.telegram.org/resources/cidr.txt')
    .then(r => r.text())
    .then(t => {
      for (const ipCIDR of t.split(/\r?\n/)) {
        if (ipCIDR.indexOf('.') != -1) {
          rules.push('IP-CIDR,' + ipCIDR + ',Telegram,no-resolve');
        } else if (ipCIDR.indexOf(':') != -1) {
          rules.push('IP-CIDR6,' + ipCIDR + ',Telegram,no-resolve');
        }
      }
    });
  const domainListsUrlPrefix = 'https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/';
  const domainLists = {
    'CHN': 'accelerated-domains.china.conf',
    'Apple-CHN': 'apple.china.conf',
    'Google-CHN': 'google.china.conf',
  };
  for (const i in domainLists) {
    await fetch(domainListsUrlPrefix + domainLists[i])
      .then(r => r.text())
      .then(t => {
        for (const m of t.split(/\r?\n/)) {
          if (m.startsWith('server')) {
            let domain = m.slice(m.indexOf('/') + 1, m.lastIndexOf('/'))
            rules.push('DOMAIN-SUFFIX,' + domain + ',' + i);
          }
        }
      });
  }
  rules.push('MATCH,Final');
  sub['rules'] = rules;
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

async function handleRequest(request, {remoteResourceRoot, DB}) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const routeConvert = '/sip008'
  const routeGet = '/get'
  const routeCodeSrc = '/src.js'
  const routeClashTemplate = '/clash.json'

  const pageUrl = new URL('ui.html', remoteResourceRoot).toString();
  const codeUrl = new URL('worker.js', remoteResourceRoot).toString();
  const clashConfigUrl = new URL('clash.json', remoteResourceRoot).toString();

  const getValueOfKey = async function (sId) {
    if (sId === '' || sId === null) return null;
    return await DB.get(sId);
  };

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
      let s = {};
      for (let i = 0; i < shareLinks.length; i += 1) {
        if (shareLinks[i] == '') continue;
        s[i] = shareLinks[i];
      }
      const t = url.searchParams.get("sub");
      switch (t) {
        case 'clash':
          return new Response(dumpToYaml(await makeClashSub(s, [], clashConfigUrl)), {
            status: 200,
            headers: {
              "content-type": "application/yaml;charset=utf-8"
            }
          });
          break;
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
        let s = {};
        let c = [];  // proxy chains
        for (let f of l) {
          const q = f.split(':').map(i => i.trim());
          if (q.length > 1) {
            c.push(q);
            for (const i of q) { 
              if (!s[i]) {
                const z = await getValueOfKey(i);
                if (z !== null || z !== '') s[i] = z;
              }
            }
          } else {
            const z = await getValueOfKey(q[0]);
            if (z !== null || z !== '') s[q[0]] = z;
          }
        }
        switch (t) {
          case 'clash':
            return new Response(dumpToYaml(await makeClashSub(s, c, clashConfigUrl)), {
              status: 200,
              headers: {
                "content-type": "application/yaml;charset=utf-8"
              }
            });
            break;
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
    let code;
    await fetch(codeUrl).then((r) => r.text()).then((t) => { code = t; });
    return new Response(code, {
      status: 200,
      headers: {
        "content-type": "text/plain;charset=utf-8"
      }
    });
  } else if (pathname.startsWith(routeClashTemplate)) {
    let text;
    const f = url.searchParams.get("format");
    await fetch(clashConfigUrl).then((r) => r.text()).then((t) => { text = t; });
    if (f == 'yaml') {
      text = dumpToYaml(JSON.parse(text));
    }
    return new Response(text, {
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
