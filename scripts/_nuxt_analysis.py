#!/usr/bin/env python3
"""生成 base64 编码的 JS 代码用于分析 haowallpaper 页面"""
import base64
import sys

action = sys.argv[1] if len(sys.argv) > 1 else "default"

scripts = {
    # 拦截所有网络请求（包括 fetch body 和 response）
    "intercept_all": """
var intercepted = [];
// 拦截 fetch
var origFetch = window.fetch;
window.fetch = function() {
    var url = arguments[0];
    var opts = arguments[1] || {};
    var entry = {type:'fetch', url: typeof url==='string'?url:url.url, method: opts.method||'GET', time: Date.now()};
    if (opts.body) entry.body = typeof opts.body==='string'?opts.body.substring(0,500):'non-string';
    if (opts.headers) entry.headers = JSON.stringify(opts.headers).substring(0,300);
    intercepted.push(entry);
    return origFetch.apply(this, arguments).then(function(resp) {
        var idx = intercepted.length - 1;
        intercepted[idx].status = resp.status;
        intercepted[idx].respType = resp.headers.get('content-type') || '';
        return resp;
    });
};
// 拦截 XMLHttpRequest
var origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(m,u) {
    this._interceptInfo = {type:'xhr', method:m, url:u, time: Date.now()};
    return origOpen.apply(this, arguments);
};
var origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(b) {
    if (this._interceptInfo) {
        if (b) this._interceptInfo.body = typeof b==='string'?b.substring(0,500):'non-string';
        intercepted.push(this._interceptInfo);
    }
    return origSend.apply(this, arguments);
};
// 拦截 window.open 和 location 改变（下载可能通过这些方式触发）
var origWindowOpen = window.open;
window.open = function(url) {
    intercepted.push({type:'window.open', url:url, time:Date.now()});
    return origWindowOpen.apply(this, arguments);
};
// 拦截 a.click() 下载
var origClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function() {
    if (this.href) {
        intercepted.push({type:'a.click', url:this.href, download:this.download, time:Date.now()});
    }
    return origClick.apply(this, arguments);
};
window.__intercepted = intercepted;
JSON.stringify({status:'all_interceptors_installed'});
""",

    # 点击下载按钮
    "click_download": """
var btn = document.querySelector('.DownButtom');
if (btn) { btn.click(); JSON.stringify({clicked:true, text:btn.textContent.trim()}); }
else { JSON.stringify({clicked:false}); }
""",

    # 检查拦截到的请求
    "check_requests": """
JSON.stringify(window.__intercepted || []);
""",

    # 检查页面上是否有 Altcha 组件
    "check_altcha": """
var altchaEls = document.querySelectorAll('altcha-widget, [class*=altcha], [class*=Altcha], [class*=verification]');
var result = [];
for (var i = 0; i < altchaEls.length; i++) {
    var el = altchaEls[i];
    result.push({
        tag: el.tagName,
        class: el.className,
        visible: el.offsetHeight > 0,
        attrs: {}
    });
    var attrs = el.attributes;
    for (var j = 0; j < attrs.length; j++) {
        result[result.length-1].attrs[attrs[j].name] = attrs[j].value.substring(0, 200);
    }
}
// 也检查 shadow DOM
var allEls = document.querySelectorAll('*');
var shadowHosts = [];
for (var i = 0; i < allEls.length; i++) {
    if (allEls[i].shadowRoot) {
        shadowHosts.push({tag: allEls[i].tagName, class: allEls[i].className});
    }
}
JSON.stringify({altchaElements: result, shadowHosts: shadowHosts.slice(0, 10)});
""",

    # 获取 Altcha widget 的详细属性
    "get_altcha_details": """
var widgets = document.querySelectorAll('altcha-widget');
if (widgets.length === 0) {
    // 尝试搜索更广泛的元素
    var allIframes = document.querySelectorAll('iframe');
    var iframes = [];
    for (var i = 0; i < allIframes.length; i++) {
        iframes.push({src: allIframes[i].src, id: allIframes[i].id});
    }
    JSON.stringify({noAltchaWidget: true, iframes: iframes});
} else {
    var w = widgets[0];
    var info = {tag: w.tagName, html: w.outerHTML.substring(0, 1000)};
    JSON.stringify(info);
}
""",
}

js_code = scripts.get(action, 'JSON.stringify({error:"unknown action: ' + action + '"})')
encoded = base64.b64encode(js_code.encode()).decode()
print(encoded)