import { ClashSsNodeConfig } from "./types/clash.ts";
import { SIP008Node } from "./types/shadowsocks.ts";

export function sip008toClash(obj: SIP008Node) {
  const config: ClashSsNodeConfig = {
    'name': obj['remarks'],
    'type': 'ss',
    'server': obj['server'],
    'port': obj['server_port'],
    'cipher': obj['method'] === 'none' ? 'dummy' : obj['method'],
    'password': obj['password'],
  }
  if (obj['plugin']) {
    const opts: {[i: string]: string} = {};
    if (obj['plugin_opts']) {
      for (const opt of obj['plugin_opts'].split(';')) {
        const l = opt.split('=');
        opts[l[0]] = (l.length > 1) ? l[1] : l[0];
      }
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

export function sip008toSs(obj: SIP008Node) {
  const credentialPart = obj['method'].startsWith('2022-')
    ? `${encodeURIComponent(obj['method'])}:${encodeURIComponent(obj['password'])}`
    : btoa(`${obj['method']}:${obj['password']}`);
  const pluginAndOpts = (obj['plugin']) ? obj['plugin'] + (obj['plugin_opts'] ? `;${obj['plugin_opts']}` : '') : undefined;
  const query = pluginAndOpts ? `?plugin=${encodeURIComponent(pluginAndOpts)}` : '';
  return `ss://${credentialPart}@${obj['server']}:${obj['server_port']}${query}#${encodeURIComponent(obj['remarks'])}`;
}
