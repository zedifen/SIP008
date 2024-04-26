import { ClashVmessNodeConfig } from "./types/clash.ts";
import { SIP008Node, ShadowsocksAndroidRouteOption } from "./types/shadowsocks.ts";
import { V2RayNVmessShareLinkConfig } from "./types/v2rayn.ts";
import { decodeBase64EncodedUTF8 } from "./utils/base64.ts";

export function ssToSIP008(link: string, route?: ShadowsocksAndroidRouteOption) {
  const u = link.substring(5); // skip 'ss://'
  const p = u.split('#');
  const name = decodeURIComponent(p[1]);
  const l = p[0].split('@');
  const c = (l[0].indexOf(':') != -1) ? l[0].split(':').map(decodeURIComponent) : atob(l[0]).split(':');
  const method = c[0];
  const password = c[1];
  const s = l[1].split(':');
  const o = s[1].split('?');
  const address = s[0];
  const port = Number(o[0].split('/')[0]);
  const params = o[1];
  const obj: SIP008Node = {
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

export function vmessLinkToClash(link: string): ClashVmessNodeConfig {
  const d: V2RayNVmessShareLinkConfig = JSON.parse(decodeBase64EncodedUTF8(link.slice(8)));  // skip 'vmess://'
  const configBase = {
    name: d['ps'] || d['remark'] || 'vmess',
    server: d['add'],
    port: d['port'],
    uuid: d['id'],
    alterId: d['aid'] || 0,
    cipher: d['scy'] || 'auto',
    tls: d['tls'] === 'tls',
    network: d['net'],
  };
  switch (d['net']) {
    case 'ws':
      return {
        ...configBase,
        'type': 'vmess',
        'network': 'ws',
        'ws-opts': {
          path: d['path'],
          headers: {
            'Host': d['host'] || d['sni'],
          },
          'max-early-data': 2048,
          'early-data-header-name': 'Sec-WebSocket-Protocol',
        }
      }
    case 'h2':
      return {
        ...configBase,
        'type': 'vmess',
        'tls': true,
        'network': 'h2',
        'h2-opts': {
          host: [
            d['host'],
          ],
          path: d['path'],
        }
      }
    case 'http':
      return {
        ...configBase,
        'type': 'vmess',
        'network': 'http',
        'http-opts': {
          method: 'GET',
          path: [
            d['path'],
          ]
        }
      };
    default:
      return (configBase as ClashVmessNodeConfig);
  }
}
