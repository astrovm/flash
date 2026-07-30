const params = new URLSearchParams(window.location.search);
const cloudSavesStatus = document.getElementById('cloud-saves-status');
var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById('spinner');
var wasm_content = params.get("wasm");
const currentLanguage = "en";
const cheatsEnabled = false;
const maxFPS = 0;
const haveOriginalGame = true;
const replaceFetch = (url) => url.replace("https://cdn.dos.zone/vcsky/", "");

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let isTouch = isMobile && window.matchMedia('(pointer: coarse)').matches;

document.body.dataset.isTouch = isTouch ? 1 : 0;

const dataSize = 130 * 1024 * 1024;
const textDecoder = new TextDecoder();
(function () {
    const translations = {
        en: {
            clickToPlayDemo: "Click to play demo",
            clickToPlayFull: "Click to play",
            invalidKey: "invalid key",
            checking: "checking...",
            cloudSaves: "Cloud saves:",
            enabled: "enabled",
            disabled: "disabled",
            playDemoText: "You can play the DEMO version, or provide the original game files to play the full version.",
            disclaimer: "DISCLAIMER:",
            disclaimerSources: "This game uses the open source reVCDOS engine. It is not a commercial release.",
            disclaimerCheckbox: "I own the original game",
            disclaimerPrompt: "You need to provide a file from the original game to confirm ownership of the original game.",
            cantContinuePlaying: "You can't continue playing in DEMO version. Please provide the original game files to continue playing.",
            demoAlert: "The demo version is intended only for familiarizing yourself with the game technology. All features are available, but you won’t be able to progress through the game’s storyline. Please provide the original game files to launch the full version.",
            downloading: "Downloading",
            enterKey: "enter your key",
            clickToContinue: "Click to continue...",
            enterJsDosKey: "Enter js-dos key",
            portBy: "HTML5 port by:",
            ruTranslate: "",
            demoOffDisclaimer: "Due to the unexpectedly high popularity of the project, resulting in significant traffic costs, and in order to avoid any risk of the project being shut down due to rights holder claims, we have disabled the demo version. You can still run the full version by providing the original game resources.",
        },
        ru: {
            clickToPlayDemo: "Играть в демо версию",
            clickToPlayFull: "Играть",
            invalidKey: "неверный ключ",
            checking: "проверка...",
            cloudSaves: "Облачные сохранения:",
            enabled: "включены",
            disabled: "выключены",
            playDemoText: "Вы можете играть в демо версию, или предоставить оригинальные файлы игры для полной версии.",
            disclaimer: "ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ:",
            disclaimerSources: "Эта игра использует движок reVCDOS с открытым исходным кодом. Это не коммерческий выпуск.",
            disclaimerCheckbox: "Я владею оригинальной игрой",
            disclaimerPrompt: "Вам потребуется приложить какой-либо файл из оригинальной игры для подтверждения владения оригинальной игрой.",
            cantContinuePlaying: "Вы не можете продолжить игру в демо версии. Пожалуйста, предоставьте оригинальные файлы игры для продолжения игры.",
            demoAlert: "Демо версия предназначена только для ознакомления с технологией игры. Все функции доступны, но вы не сможете продолжить игру по сюжету. Пожалуйста, предоставьте оригинальные файлы игры для запуска полной версии.",
            downloading: "Загрузка",
            enterKey: "введите ваш ключ",
            clickToContinue: "Нажмите для продолжения...",
            enterJsDosKey: "Введите ключ js-dos",
            portBy: "Авторы HTML5 порта:",
            ruTranslate: `
<div class="translated-by">
    <span>Переведено на русский студией</span>
    <a href="https://www.gamesvoice.ru/" target="_blank">GamesVoice</a>
</div>
`,
            demoOffDisclaimer: "В связи с неожиданно высокой популярностью проекта, как следствие — значительными расходами на трафик, а также во избежание рисков закрытия проекта из-за претензий правообладателей, мы отключили возможность запуска демо-версии. При этом вы по-прежнему можете запустить полную версию, предоставив оригинальные ресурсы.",
        },
    };

    let currentLanguage = navigator.language.split("-")[0] === "ru" ? "ru" : "en";
    if (params.get("lang") === "ru") {
        currentLanguage = "ru";
    }
    if (params.get("lang") === "en") {
        currentLanguage = "en";
    }

    window.t = function (key) {
        return translations[currentLanguage][key];
    }
})();

function requestParent(event, payload, responseEvent) {
    return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const listener = (messageEvent) => {
            const data = messageEvent.data;
            if (data?.event !== responseEvent || data.requestId !== requestId) return;
            window.removeEventListener("message", listener);
            if (data.error) reject(new Error(data.error));
            else resolve(data.data);
        };
        window.addEventListener("message", listener);
        window.parent.postMessage({ event, requestId, ...payload }, location.origin);
    });
}

async function loadData() {
    setStatus("Preparing local game data…");
    const files = DATA_PACKAGE.files.map(({ filename, start, end }) => ({
        path: filename.replace(/^\/+/, ""),
        start,
        end,
    }));
    const buffer = await requestParent(
        "module.package",
        { files, size: DATA_PACKAGE.remote_package_size },
        ">module.package",
    );
    return new Uint8Array(buffer);
}

async function startGame(e) {
    e.stopPropagation();

    document.querySelector('.start-container').style.display = 'none';
    document.querySelector('.developed-by').style.display = 'none';
    document.querySelector('.click-to-play').style.display = 'none';

    loadData().then(loadGame).catch((error) => {
        console.error("Unable to prepare local game data:", error);
        setStatus(`Unable to prepare local game data: ${error.message}`);
    });
}

function setStatus(text) {
    console.log(text);
    if (statusElement) statusElement.textContent = text || "";
};

async function loadGame(data) {
    var Module = {
        getPreloadedPackage: () => data.buffer,
        fetchLocalAsset: (file) => requestParent(
            "module.getfile",
            { file: file.replaceAll("\\", "/").replace(/^\/+/, "") },
            ">module.getfile",
        ),
        mainCalled: () => {
            try {
                try {
                    Module.FS.unlink("/vc-assets/local/revc.ini");
                } catch (e) {
                    // ignore
                }
                Module.FS.createDataFile("/vc-assets/local/revc.ini", 0, revc_ini, revc_ini.length);
            } catch (e) {
                console.error('mainCalled error:', e);
            }
        },
        syncRevcIni: () => {
            try {
                const path = Module.FS.lookupPath("/vc-assets/local/revc.ini");
                if (path && path.node && path.node.contents) {
                    localStorage.setItem('vcsky.revc.ini', textDecoder.decode(path.node.contents));
                }
            } catch (e) {
                console.error('syncRevcIni error:', e);
            }
        },
        preRun: [],
        postRun: [],
        print: (...args) => console.log(args.join(' ')),
        printErr: (...args) => console.error(args.join(' ')),
        canvas: function () {
            const canvas = document.getElementById('canvas');
            canvas.addEventListener('webglcontextlost', (e) => {
                statusElement.textContent = 'WebGL context lost. Please reload the page.';
                e.preventDefault();
            });
            return canvas;
        }(),
        setStatus,
        totalDependencies: 0,
        monitorRunDependencies: (num) => {
            Module.totalDependencies = Math.max(Module.totalDependencies, num);
            Module.setStatus(`Preparing... (${Module.totalDependencies - num}/${Module.totalDependencies})`);
        },
        hotelMission: () => {
            if (!haveOriginalGame) {
                showWasted();
                alert(t("cantContinuePlaying"));
                throw new Error(t("cantContinuePlaying"));
            }
        },
    };
    Module.log = Module.print;
    Module.instantiateWasm = async (
        info,
        receiveInstance,
    ) => {
        const wasm = await (await fetch(wasm_content ? wasm_content : "index.wasm")).arrayBuffer();
        const module = await WebAssembly.instantiate(wasm, info);
        return receiveInstance(module.instance, module);
    };
    Module.arguments = window.location.search
        .slice(1)
        .split('&')
        .filter(Boolean)
        .map(decodeURIComponent);
    window.onbeforeunload = function (event) {
        event.preventDefault();
        return '';
    };

    window.Module = Module;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'index.js';
    document.body.appendChild(script);

    document.body.classList.add('gameIsStarted');

    const emulator = new GamepadEmulator();
    const gamepad = emulator.AddEmulatedGamepad(null, true);
    const gamepadEmulatorConfig = {
        directions: { up: true, down: true, left: true, right: true },
        dragDistance: 100,
        tapTarget: move,
        lockTargetWhilePressed: true,
        xAxisIndex: 0,
        yAxisIndex: 1,
        swapAxes: false,
        invertX: false,
        invertY: false,
    };
    emulator.AddDisplayJoystickEventListeners(0, [gamepadEmulatorConfig]);
    const gamepadEmulatorConfig1 = {
        directions: { up: true, down: true, left: true, right: true },
        dragDistance: 100,
        tapTarget: look,
        lockTargetWhilePressed: true,
        xAxisIndex: 2,
        yAxisIndex: 3,
        swapAxes: false,
        invertX: false,
        invertY: false,
    };
    emulator.AddDisplayJoystickEventListeners(0, [gamepadEmulatorConfig1]);

    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 9,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.menu'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 3,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.car.getIn'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 0,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.run'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 1,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.fist'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 5,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.drift'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 2,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.jump'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 4,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.mobile'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 11,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.job'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 4,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.radio'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 7,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.weapon'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 8,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.camera'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 10,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.horn'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 7,
        buttonIndexes: [1, 7],
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.fireRight'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 6,
        buttonIndexes: [1, 6],
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.fireLeft'),
    }]);
}

const clickToPlay = document.querySelector('.click-to-play');
const clickLink = clickToPlay.querySelector('button');
clickToPlay.addEventListener('click', (e) => {
    if (e.target === clickToPlay || e.target === clickLink) {
        startGame(e);
    } else if (window.top !== window) {
        window.parent.postMessage({
            event: 'request-fullscreen',
        }, '*');
    }
});

const savesMountPoint = "/vc-assets/local/userfiles";
const savesFile = "vcsky.saves";
wrapIDBFS(console.log).addListener({
    onLoad: (_, mount) => {
        if (mount.mountpoint !== savesMountPoint) {
            return null;
        }
        const token = localStorage.getItem('vcsky.key');
        if (token && token.length === 5) {
            const promise = CloudSDK.pullFromStorage(token, savesFile);
            promise.then((payload) => {
                console.log('[IDBFS] onLoad', token, payload ? payload.length / 1024 : 0, 'kb');
            });
            return promise;
        }
        return null;
    },
    onSave: (getData, _, mount) => {
        if (mount.mountpoint !== savesMountPoint) {
            return;
        }
        const token = localStorage.getItem('vcsky.key');
        if (token && token.length === 5) {
            getData().then((payload) => {
                if (payload.length > 0) {
                    console.log('[IDBFS] onSave', token, payload.length / 1024, 'kb');
                    return CloudSDK.pushToStorage(token, savesFile, payload);
                }
            });
        }
    },
});


function updateToken(token) {
    cloudSavesStatus.textContent = t('checking');
    if (token.length === 5) {
        CloudSDK.resolveToken(token).then((profile) => {
            if (profile) {
                console.log('[CloudSdk] resolveToken', profile);
                localStorage.setItem('vcsky.key', profile.token);
                if (profile.premium) {
                    keyStatus.textContent = t('enabled');
                    keyStatus.style.color = 'green';
                    keyStatus.style.fontWeight = 'bold';
                } else {
                    keyStatus.textContent = t('disabled');
                    keyStatus.style.color = 'red';
                    keyStatus.style.fontWeight = 'bold';
                }
            } else {
                keyStatus.textContent = t('invalidKey');
                keyStatus.style.color = 'white';
                keyStatus.style.fontWeight = 'normal';
            }
        });
    } else {
        cloudSavesStatus.textContent = t('enterKey');
    }
}

const keyInput = document.querySelector('.jsdos-key-input');
keyInput.setAttribute('placeholder', t("enterJsDosKey"));
const keyStatus = document.querySelector('.jsdos-key-status');
keyInput.addEventListener('paste', (e) => {
    setTimeout(() => {
        updateToken(e.target.value);
    }, 100);
});

keyInput.addEventListener('keyup', (e) => {
    updateToken(e.target.value);
});

if (localStorage.getItem('vcsky.key')) {
    keyInput.value = localStorage.getItem('vcsky.key');
    updateToken(keyInput.value);
} else {
    keyStatus.textContent = t('invalidKey');
    keyStatus.style.color = 'shite';
    keyStatus.style.fontWeight = 'normal';
}

const clickToPlayButton = document.getElementById('click-to-play-button');
clickToPlayButton.textContent = t('clickToPlayFull');
const cloudSavesLink = document.getElementById('cloud-saves-link');
cloudSavesLink.textContent = t('cloudSaves');
cloudSavesStatus.textContent = t('enterKey');
const developedBy = document.querySelector('.developed-by');
developedBy.innerHTML += t('ruTranslate');
const portBy = document.getElementById('port-by');
portBy.textContent = t('portBy');


const revc_iniDefault = `
[VideoMode]
Width=800
Height=600
Depth=32
Subsystem=0
Windowed=0
[Controller]
HeadBob1stPerson=0
HorizantalMouseSens=0.002500
InvertMouseVertically=1
DisableMouseSteering=1
Vibration=0
Method=${isTouch ? '1' : '0'}
InvertPad=0
JoystickName=
PadButtonsInited=0
[Audio]
SfxVolume=36
MusicVolume=37
MP3BoostVolume=0
Radio=0
SpeakerType=0
Provider=0
DynamicAcoustics=1
[Display]
Brightness=256
DrawDistance=1.800000
Subtitles=0
ShowHud=1
RadarMode=0
ShowLegends=0
PedDensity=1.200000
CarDensity=1.200000
CutsceneBorders=1
FreeCam=0
[Graphics]
AspectRatio=0
VSync=1
Trails=1
FrameLimiter=0
MultiSampling=0
IslandLoading=0
PS2AlphaTest=1
ColourFilter=2
MotionBlur=0
VehiclePipeline=0
NeoRimLight=0
NeoLightMaps=0
NeoRoadGloss=0
[General]
SkinFile=$$""
Language=0
DrawVersionText=0
NoMovies=0
[CustomPipesValues]
PostFXIntensity=1.000000
NeoVehicleShininess=1.000000
NeoVehicleSpecularity=1.000000
RimlightMult=1.000000
LightmapMult=1.000000
GlossMult=1.000000
[Rendering]
BackfaceCulling=1
NewRenderer=1
[Draw]
ProperScaling=1
FixRadar=1
FixSprites=1
[Bindings]
PED_FIREWEAPON=mouse:LEFT,2ndKbd:PAD5
PED_CYCLE_WEAPON_RIGHT=2ndKbd:PADENTER,mouse:WHLDOWN,kbd:E
PED_CYCLE_WEAPON_LEFT=kbd:PADDEL,mouse:WHLUP,2ndKbd:Q
GO_FORWARD=kbd:UP,2ndKbd:W
GO_BACK=kbd:DOWN,2ndKbd:S
GO_LEFT=2ndKbd:A,kbd:LEFT
GO_RIGHT=kbd:RIGHT,2ndKbd:D
PED_SNIPER_ZOOM_IN=kbd:PGUP,2ndKbd:Z,mouse:WHLUP
PED_SNIPER_ZOOM_OUT=kbd:PGDN,2ndKbd:X,mouse:WHLDOWN
VEHICLE_ENTER_EXIT=kbd:ENTER,2ndKbd:F
CAMERA_CHANGE_VIEW_ALL_SITUATIONS=kbd:HOME,2ndKbd:V
PED_JUMPING=kbd:RCTRL,2ndKbd:SPC
PED_SPRINT=2ndKbd:LSHIFT,kbd:RSHIFT
PED_LOOKBEHIND=2ndKbd:CAPSLK,mouse:MIDDLE,kbd:PADINS
PED_DUCK=kbd:C
PED_ANSWER_PHONE=kbd:TAB
VEHICLE_FIREWEAPON=kbd:PADINS,2ndKbd:LCTRL,mouse:LEFT
VEHICLE_ACCELERATE=2ndKbd:W
VEHICLE_BRAKE=2ndKbd:S
VEHICLE_CHANGE_RADIO_STATION=kbd:INS,2ndKbd:R
VEHICLE_HORN=2ndKbd:LSHIFT,kbd:RSHIFT
TOGGLE_SUBMISSIONS=kbd:PLUS,2ndKbd:CAPSLK
VEHICLE_HANDBRAKE=kbd:RCTRL,2ndKbd:SPC,mouse:RIGHT
PED_1RST_PERSON_LOOK_LEFT=kbd:PADLEFT
PED_1RST_PERSON_LOOK_RIGHT=kbd:PADHOME
VEHICLE_LOOKLEFT=kbd:PADEND,2ndKbd:Q
VEHICLE_LOOKRIGHT=kbd:PADDOWN,2ndKbd:E
VEHICLE_LOOKBEHIND=mouse:MIDDLE
VEHICLE_TURRETLEFT=kbd:PADLEFT
VEHICLE_TURRETRIGHT=kbd:PAD5
VEHICLE_TURRETUP=kbd:PADPGUP,2ndKbd:UP
VEHICLE_TURRETDOWN=kbd:PADRIGHT,2ndKbd:DOWN
PED_CYCLE_TARGET_LEFT=kbd:[,2ndKbd:PADEND
PED_CYCLE_TARGET_RIGHT=2ndKbd:],kbd:PADDOWN
PED_CENTER_CAMERA_BEHIND_PLAYER=kbd:#
PED_LOCK_TARGET=kbd:DEL,mouse:RIGHT,2ndKbd:PADRIGHT
NETWORK_TALK=kbd:T
PED_1RST_PERSON_LOOK_UP=kbd:PADPGUP
PED_1RST_PERSON_LOOK_DOWN=kbd:PADUP
_CONTROLLERACTION_36=
TOGGLE_DPAD=
SWITCH_DEBUG_CAM_ON=
TAKE_SCREEN_SHOT=
SHOW_MOUSE_POINTER_TOGGLE=
UNKNOWN_ACTION=

`;

const revc_ini = (() => {
    const cached = localStorage.getItem('vcsky.revc.ini');
    if (cached) {
        return cached;
    }
    return revc_iniDefault;
})();
