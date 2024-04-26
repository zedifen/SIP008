// recursively dumping an object to yaml
export function dumpToYaml(obj: any, depth=0, inArray?: boolean) {
  const indent = '  ';
  let s = '';
  const isArray = Array.isArray(obj);
  for (const i in obj) {
    s += (inArray ? '' : indent.repeat(depth)) + (isArray ? '-' : `${i}:`);
    inArray = false;
    const val = obj[i];
    switch (typeof val) {
      case 'string': {
        const l = val.split('\n');
        const d = '\n' + indent.repeat(depth + 1);
        s += l.length > 1 
        /*  |[  If there's spaces to be preserved in front of line     ][  ][          ] */
        ? ` |${l[0][0] === ' ' ? `${indent.length * (depth + 1)}-` : ''}${d}${l.join(d)}`    // Muiltiple lines
        : '`~!@#%&:,?\'"{}[]|-'.includes(val[0]) ? ` "${val.replaceAll('"', '\\"')}"` : ` ${val}`; // A single line
        s += '\n';
        break;
      }
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
