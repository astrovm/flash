if(!self.define){let e,a={};const i=(i,s)=>(i=new URL(i+".js",s).href,a[i]||new Promise((a=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=a,document.head.appendChild(e)}else e=i,importScripts(i),a()})).then((()=>{let e=a[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(s,f)=>{const r=e||("document"in self?document.currentScript.src:"")||location.href;if(a[r])return;let d={};const c=e=>i(e,r),b={module:{uri:r},exports:d,require:c};a[r]=Promise.all(s.map((e=>b[e]||c(e)))).then((e=>(f(...e),d)))}}define(["./workbox-5323b980"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"css/ComicNeue-Bold.woff2",revision:"07661bd208eed16aa0ff49baa5e5a55d"},{url:"css/main.1.css",revision:"0b2097f0c241f63715a2498b6818ae30"},{url:"favicon.ico",revision:"32fe9a6715afd8dc4132c6dc3c1f8472"},{url:"iframe/inside-the-firewall/assets/06c4635dc7d08c1aa2f9d341a59ad04f.svg",revision:"06c4635dc7d08c1aa2f9d341a59ad04f"},{url:"iframe/inside-the-firewall/assets/146f0d179dfe707bfb396836adac2c80.svg",revision:"146f0d179dfe707bfb396836adac2c80"},{url:"iframe/inside-the-firewall/assets/16b332b96cd7aee438497fd76ee4406e.mp3",revision:"16b332b96cd7aee438497fd76ee4406e"},{url:"iframe/inside-the-firewall/assets/17f87a80d1fd1ac024d4972154fde198.svg",revision:"17f87a80d1fd1ac024d4972154fde198"},{url:"iframe/inside-the-firewall/assets/1bd89ce863c891db58ca7ac139e0eb3c.svg",revision:"1bd89ce863c891db58ca7ac139e0eb3c"},{url:"iframe/inside-the-firewall/assets/27654ed2e3224f0a3f77c244e4fae9aa.wav",revision:"27654ed2e3224f0a3f77c244e4fae9aa"},{url:"iframe/inside-the-firewall/assets/29efc9b028b85d0dcfa754841ee892a4.svg",revision:"29efc9b028b85d0dcfa754841ee892a4"},{url:"iframe/inside-the-firewall/assets/3969c15be87bee7bdae171625d44a33c.png",revision:"3969c15be87bee7bdae171625d44a33c"},{url:"iframe/inside-the-firewall/assets/3a0f085b354113261e84dbbe4cc9abf5.svg",revision:"3a0f085b354113261e84dbbe4cc9abf5"},{url:"iframe/inside-the-firewall/assets/42a968a970a6fe6597cc1b8265f3bdd8.png",revision:"42a968a970a6fe6597cc1b8265f3bdd8"},{url:"iframe/inside-the-firewall/assets/6026deaa98b64d9432b4de8256b9c3fa.svg",revision:"6026deaa98b64d9432b4de8256b9c3fa"},{url:"iframe/inside-the-firewall/assets/6f46dd663b33bdf6067ef34106f59977.mp3",revision:"6f46dd663b33bdf6067ef34106f59977"},{url:"iframe/inside-the-firewall/assets/83c36d806dc92327b9e7049a565c6bff.wav",revision:"83c36d806dc92327b9e7049a565c6bff"},{url:"iframe/inside-the-firewall/assets/9c019920fc0ee60402479a9fa3d88f54.svg",revision:"9c019920fc0ee60402479a9fa3d88f54"},{url:"iframe/inside-the-firewall/assets/a9353efd70dde6c1acd72ea330bf7c13.svg",revision:"a9353efd70dde6c1acd72ea330bf7c13"},{url:"iframe/inside-the-firewall/assets/c4f59fb112c5fa52c303a7e0d439e007.png",revision:"c4f59fb112c5fa52c303a7e0d439e007"},{url:"iframe/inside-the-firewall/assets/d3a30bdaa6248c4467c7b7334e4ebe0b.svg",revision:"d3a30bdaa6248c4467c7b7334e4ebe0b"},{url:"iframe/inside-the-firewall/assets/df7a1d2d829265bb78fdce5a74528271.mp3",revision:"df7a1d2d829265bb78fdce5a74528271"},{url:"iframe/inside-the-firewall/assets/ea191cb0801c54b5cf7ba312b826216f.svg",revision:"ea191cb0801c54b5cf7ba312b826216f"},{url:"iframe/inside-the-firewall/assets/ebf345f4140e25777a22f67677967b96.svg",revision:"ebf345f4140e25777a22f67677967b96"},{url:"iframe/inside-the-firewall/assets/project.json",revision:"c01d7178725aed8e86d8295c68bb6b8b"},{url:"iframe/inside-the-firewall/index.html",revision:"a09ba263af9248bae5a82f45496c18da"},{url:"iframe/inside-the-firewall/script.js",revision:"7419f0de407dce32cdd09783df20381a"},{url:"index.html",revision:"98bbc3af9ba8d82c9bb5e702d7946d0a"},{url:"js/31c1f3143d06649500b2.wasm",revision:"e7186874942119e893cb5bd8cdd912a3"},{url:"js/core.ruffle.13adb9036a0c9ea2efbc.js",revision:"7aa27eaf4796d7d19321249397e9b3f6"},{url:"js/main.10.js",revision:"991317300548daca3c57100fbe7b7144"},{url:"js/ruffle.min.js",revision:"97d06beb6c37c70aee3b962229907e39"},{url:"swf/big-truck-adventures-2/main.swf",revision:"b434e799ba5bec02676e0517ceba85b3"},{url:"swf/big-truck-adventures/main.swf",revision:"f7dfb8ce39a3ae501251aafb5dc0a8cf"},{url:"swf/bike-mania-2/main.swf",revision:"f010050a4c20321956ce4c131ee51c2f"},{url:"swf/bike-mania-3/main.swf",revision:"eae80e60236b1a93f61d65be688fe2a1"},{url:"swf/bike-mania-4/main.swf",revision:"cf84e3fd74329ffbdad44c7e8ffeac40"},{url:"swf/bike-mania-5/main.swf",revision:"35fc8bcfb45577c5e7e923e41714f191"},{url:"swf/bike-mania-arena-2/main.swf",revision:"2d7344aaaacd616d07b8617719bc330c"},{url:"swf/bike-mania-arena-3/main.swf",revision:"06c28b32f00b60af0edb78c2374c2b34"},{url:"swf/bike-mania-arena-4/main.swf",revision:"3d50e3731d56bb987409f55027d11d2d"},{url:"swf/bike-mania-arena-5/main.swf",revision:"2d7a22ff3e6f8d8027abe6f99ea90164"},{url:"swf/bike-mania-arena/main.swf",revision:"20a8839b1f07cbb13a7935c9162f0a45"},{url:"swf/bike-mania/main.swf",revision:"d4ca1568e826078814c6935e31808298"},{url:"swf/captain-usa/main.swf",revision:"8195897f5ab65e257e5bfd8b055c90f1"},{url:"swf/dark-cut/main.swf",revision:"9681c92f9745372f0594e36bcee691ee"},{url:"swf/dexter-runaway-robot/main.swf",revision:"a44fc239f33b90351f11fb017ac10ed4"},{url:"swf/dirt-bike-2/main.swf",revision:"4bffad5a2ab463d0687b13c9f53b54f9"},{url:"swf/dirt-bike/main.swf",revision:"20cd58ce9d42c0d93b9a9f79fcf06e25"},{url:"swf/do-not-press/main.swf",revision:"dd2ab8244202ad15c4e38fd5a7811c44"},{url:"swf/eds-candy-machine/main.swf",revision:"10970b7ff2ec2a0ceac105f596e61c04"},{url:"swf/knd-numbuh-generator/main.swf",revision:"2049d064657971eeebb9ad096ac51304"},{url:"swf/knd-operation-startup/Level1Gold.swf",revision:"111ad5d4534aafc73703ee8144e8d5a8"},{url:"swf/knd-operation-startup/Level2Gold.swf",revision:"9fadc7374feaab425a03b293b8ab0d4b"},{url:"swf/knd-operation-startup/Level3Gold.swf",revision:"a9991f4eea2e59fed719cd800cd1da09"},{url:"swf/knd-operation-startup/Level4Gold.swf",revision:"a1c47d0a7c86bd35bb352ef587edd3bd"},{url:"swf/knd-operation-startup/Level5Gold.swf",revision:"be9d8c2e1c6b89be29e2c99fae55d3fe"},{url:"swf/knd-operation-startup/main.swf",revision:"f313138f43967fc43ccf654071145fd6"},{url:"swf/la-isla-de-lo-mono/main.swf",revision:"18ae5fc754e058bed032a5a489f664a1"},{url:"swf/la-isla-de-lo-mono/parte1b.swf",revision:"d9a02cf1f0835b6362dc95dc43501b21"},{url:"swf/learn-to-fly-2/main.swf",revision:"48a05c6802a2a017bec0425b98c12284"},{url:"swf/learn-to-fly-3/main.swf",revision:"f0fb1f1d5fcf2b22392620cd3e5fe7a6"},{url:"swf/learn-to-fly/main.swf",revision:"ebb48b3fdbfb5c35119c2c6ee71cf1fa"},{url:"swf/metal-slug-brutal/main.swf",revision:"4cbe0cabf0005c6d09f890740dd0f124"},{url:"swf/portal-flash/main.swf",revision:"46007300b8d9e6735424d261a83cbca8"},{url:"swf/riddle-school-2/main.swf",revision:"294cd4b24ee7c7370e4406b5641245a8"},{url:"swf/riddle-school/main.swf",revision:"2e7280258131833402275da86b59f6df"},{url:"swf/simpsons-wrecking-ball/gamezhero2.swf",revision:"d41d8cd98f00b204e9800998ecf8427e"},{url:"swf/simpsons-wrecking-ball/language.xml",revision:"11270b6e9848b6c6d91b323612d9ee60"},{url:"swf/simpsons-wrecking-ball/main.swf",revision:"52cbec96c4f50a8d7227a0557e904ac2"},{url:"swf/simpsons-wrecking-ball/wrecksnd.swf",revision:"dbccc4dcc833d4f2df3920202272bb39"},{url:"swf/stunt-dirt-bike/main.swf",revision:"b2a661a9bfba65b38e254ae9a1d65e58"},{url:"swf/sugar-sugar/main.swf",revision:"8ccda6a5c56d4eaa062477a614f3c9ec"},{url:"swf/super-smash-flash/main.swf",revision:"a61485476e0084d9ab6e3b853976deab"},{url:"swf/ultimate-flash-sonic/main.swf",revision:"8812b1604bd808f77fde2d3a544fc1ad"},{url:"swf/whack-a-kass/bios.swf",revision:"101bed16789dc8307b392983c8963b04"},{url:"swf/whack-a-kass/g53_v22.swf",revision:"e5d1eb7f52d13500d32af7de4d074eb6"},{url:"swf/whack-a-kass/gettranslationxml.phtml",revision:"369d39bb5bfa6b856700c49fc0417266"},{url:"swf/whack-a-kass/main.swf",revision:"03cc2160da56fd8bb3e193c095e0b5da"},{url:"swf/whack-a-kass/np6_include_v1.swf",revision:"176e4c07070c8aca406f6ff2dcaebc02"},{url:"swf/whack-a-kass/preloader_v1_en.swf",revision:"412a77f68c6c1e4ba4275a1f0753d464"}],{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/]})}));
//# sourceMappingURL=sw.js.map
