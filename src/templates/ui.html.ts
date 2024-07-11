export const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Convert V2RayN/SIP008 subscription to SIP008/V2RayN. Powered by Cloudflare Workers.">
  <link rel="icon" type="image/png" href="https://workers.cloudflare.com/favicon.ico" sizes="48x48">
  <title>SIP008/V2RayN Subscription Services</title>
  <style>
body {
  padding: 10px;
  margin-left: auto;
  margin-right: auto;
  width: 640px;
  max-width: 95%;
}
.link-input {
  display: flex;
  flex-direction: row;
}
.link-input > * {
  margin-right: 5px;
}
.link-input input {
  width: 100%;
  cursor: pointer;
}
.link-input :last-child {
  width: 50px;
}
input {
  border: solid grey 1px;
  border-radius: 3px;
  background-color: #ddd;
}
button {
  color: #333;
}
input:invalid + span::after {
  content: "✖";
  color: red;
}
input:valid + span::after {
  content: "✓";
  color: green;
}
.info {
  background-color: lightblue;
  border-radius: 5px;
  padding: 10px 25px;
}
@media (prefers-color-scheme: dark) {
  body {
    color: #ddd;
    background-color: #222;
  }
  .info {
    background-color: darkslategray;
  }
  a {
    color: lightblue;
  }
  input {
    background-color: #777;
    color: #111;
  }
}
  </style>
</head>
<body>
  <h1>Subscription Services</h1>
<div class="info">
  <p>Powered by <strong>Cloudflare Workers</strong>.</p>
  <p>This service will not store the data you provided. This page is served as-is, while the script source can be checked at: <a href="./src.js">src.js</a>.</p>
  <p>Clash configuration template in use: <a href="./src/templates/clash.json">clash.json</a> (<a href="./src/templates/clash.json?format=yaml">YAML format</a>).</p>
  <p>For safety you may want to host this yourself, then please follow the instructions in <a href="./src.js">the script</a>.</p>
</div>
  <h2>Convert <select name="subscriptionLinkType" id="subscription-link-type">
    <option value="v2rayn" selected>V2RayN</option>
    <option value="sip008">SIP008</option>
  </select> Subscriptions</h2>
  <div><p><label for="routeOption">
      Route options <a href="https://github.com/shadowsocks/shadowsocks-android/blob/master/.github/doc-json.md" title="Feature of Shadowsocks Android">(?)</a>:
  </label>
  <select name="routeOption" id="route-option">
    <option value="all">All</option>
    <option value="bypass-lan">Bypass LAN</option>
    <option value="bypass-china">Bypass mainland China</option>
    <option value="bypass-lan-china" selected>Bypass LAN &amp; mainland China</option>
    <option value="gfwlist">GFW List</option>
    <option value="china-list">China List</option>
    <option value="custom-rules">Custom Rules</option>
  </select></p>
  <p><label for="subscriptionType">Target subscription type:</label>
  <select name="subscriptionType" id="subscription-type">
    <option value="sip008" selected>SIP008</option>
    <option value="v2rayn">V2RayN</option>
    <option value="clash">Clash</option>
  </select></p></div>
  <p>Input your subscription link: </p>
  <div class="link-input"><input 
    id="subscription-link"
    name="subscription-link"
    type="url"
    pattern="https://.*"
    title="Paste V2RayN subscription link here ..."
    placeholder="https://example.com/link/1234567abcdef"
    spellcheck="false"
    required
  /><span class="validity"></span></div>
  <p>Get converted subscription at: </p>
  <div class="link-input link-result">
    <input type="text" class="result-link" id="converted"/>
    <button type="button" class="copy-link-button">Copy</button>
  </div>
  <h2>Get Subscription by Username</h2>
  <p>Input your Username:
    <input
      type="text"
      class="result-link"
      id="username"
      placeholder="username"
      spellcheck="false"
      title="Type your username here ..."
    />
  </p>
  <p>Get your subscription at: </p>
  <div class="link-input link-result">
    <input type="text" class="result-link" id="subscription"/>
    <button type="button" class="copy-link-button">Copy</button>
  </div>
  <script>
    const subconvertPrefix = '/subconvert/';
    const origin = (window.location.origin + (window.location.pathname.startsWith(subconvertPrefix) ? subconvertPrefix.slice(0, -1) : '/')) || 'https://example.org/';
    const routeOption = document.getElementById('route-option');
    const subscriptionLinkType = document.getElementById('subscription-link-type');
    const subscriptionType = document.getElementById('subscription-type');
    const userInput = document.getElementById('subscription-link');
    const outputLink = document.getElementById('converted');
    const updateConvertedLink = (function () {
      const link = userInput.value.trim();
      let url = new URL(origin);
      switch (subscriptionLinkType.value) {
        case 'sip008':
          url.pathname += '/fromSIP008';
          break;
        case 'v2rayn':
        default:
          url.pathname += '/fromV2RayN';
          break;
      }
      switch (subscriptionType.value) {
        case 'clash':
          url.pathname += '/sub.yaml'
          url.searchParams.set('sub', 'clash');
          break;
        case 'v2rayn':
          url.pathname += '/sub'
          url.searchParams.set('sub', 'v2rayn');
          break;
        case 'sip008':
        default:
          url.pathname += '/sub.json'
          url.searchParams.set('route', routeOption.value);
          break;
      }
      url.searchParams.set('link', link);
      outputLink.value = link === '' ? '' : url.toString();
    });
    routeOption.addEventListener('input', updateConvertedLink);
    subscriptionLinkType.addEventListener('input', updateConvertedLink);
    subscriptionType.addEventListener('input', updateConvertedLink);
    userInput.addEventListener('input', updateConvertedLink);

    const usernameInput = document.getElementById('username');
    const subscriptionLink = document.getElementById('subscription');
    const updateUserSubscriptionLink = (function () {
      const username = usernameInput.value.trim();
      let url = new URL(origin);
      switch (subscriptionType.value) {
        case 'v2rayn':
          url.pathname += '/get/sub';
          url.searchParams.set('sub', 'v2rayn');
          break;
        case 'clash':
          url.pathname += '/get/sub.yaml';
          url.searchParams.set('sub', 'clash');
          break;
        case 'sip008':
        default:
          url.pathname += '/get/sub.json';
          url.searchParams.set('route', routeOption.value);
          break;
      }
      url.searchParams.set('user', username);
      subscriptionLink.value = username === '' ? '' : url.toString();
    });
    routeOption.addEventListener('input', updateUserSubscriptionLink);
    subscriptionType.addEventListener('input', updateUserSubscriptionLink);
    usernameInput.addEventListener('input', updateUserSubscriptionLink);

    const copyButtonText = 'Copy';
    const copyButtonCopiedText = 'Copied!';
    document.querySelectorAll('.link-result').forEach(linkResultContainer => {
      const resultLink = linkResultContainer.querySelector('.result-link');
      const copyButton = linkResultContainer.querySelector('.copy-link-button');
      resultLink.addEventListener('focus', () => resultLink.select());
      copyButton.addEventListener('click', () => {
        resultLink.select();
        navigator.clipboard.writeText(resultLink.value);
        copyButton.innerHTML = copyButtonCopiedText;
        setTimeout(() => {copyButton.innerHTML = copyButtonText}, 2000);
      });
    });
  </script>
</body>
</html>
`
