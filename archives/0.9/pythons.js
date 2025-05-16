"use strict";

/*  BF2 is still broken see  https://github.com/jvilk/BrowserFS/issues/325
import { configure, BFSRequire, EmscriptenFS } from './browserfs.mjs';
//import { Buffer } from 'buffer';

window.BrowserFS = {}
window.BrowserFS.configure = configure
window.BrowserFS.BFSRequire = BFSRequire
window.BrowserFS.EmscriptenFS = EmscriptenFS
window.BrowserFS.Buffer = BFSRequire('buffer')
*/
var bfs2 = false

async function import_browserfs() {
    if (window.BrowserFS)
        return
    console.warn("late import", config.cdn+"browserfs.min.js" )
    var script = document.createElement("script")
    script.src = vm.config.cdn + "browserfs.min.js"
    document.head.appendChild(script)
    await _until(defined)("BrowserFS")
}


/*  Facilities implemented in js

    js.SVG     : convert svg to png
    js.FETCH   : async GET/POST via fetch
    js.MM      : media manager
        js.MM.CAMERA
    js.VT      : terminal creation
    js.FTDI    : usb serial
    js.MISC    : todo

*/

const module_name = "pythons.js"


var config


const FETCH_FLAGS = {
    mode:"no-cors",
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    credentials: 'omit'
}


window.get_terminal_cols = function () {
    var cdefault = 132
    if (window.terminal)
        if (vm && vm.config.columns)
            cdefault = Number(vm.config.columns || cdefault)
    const cols = (window.terminal && terminal.dataset.columns) || cdefault
    return Number(cols)
}

window.get_terminal_console = function () {
    var cdefault = 0
    if (window.terminal)
        if (vm && vm.config.console)
            cdefault = Number( vm.config.console || cdefault)
    return Number( (window.terminal && terminal.dataset.console) || cdefault )
}

window.get_terminal_lines = function () {
    return Number( (window.terminal && terminal.dataset.lines) || vm.config.lines)
   // + get_terminal_console() for the phy size
}


if (window.config) {
   config = window.config
} else {
   config = {}
}

if (document.characterSet.toLowerCase() !== "utf-8")
    alert("Host page encoding must be set to UTF-8 with tag :  meta charset=utf-8")

window.addEventListener("error", function (e) {
   alert("Error occurred: " + e.error.message);
   return false;
})

window.addEventListener('unhandledrejection', function (e) {
  alert("Error occurred: " + e.reason.message);
})

function reverse(s){
    return s.split("").reverse().join("");
}


// please comment here if you find a bug
// https://stackoverflow.com/questions/5202085/javascript-equivalent-of-pythons-rsplit

String.prototype.rsplit = function(sep, maxsplit) {
    var result = []
    var src = this
    var nullsep = false

    if ( (sep === undefined) || (sep === null) || (!sep) ) {
        sep = " "
        nullsep = true
        src = src.replaceAll(sep+sep,sep)
        src = src.replaceAll(sep+sep,sep)
    }

    if (nullsep && !src)
        return []

    if (maxsplit === 0  )
        return [src]

    maxsplit = maxsplit || -1

    var data = src.split(sep)


    if (!maxsplit || (maxsplit<0) || (data.length==maxsplit+1) )
        return data

    while (data.length && (result.length < maxsplit)) {
        result.push( data.pop() )
    }
    if (result.length) {
        result.reverse()
        if (data.length>1) {
            // thx @imkzh
            return [data.join(sep), ...result ]
        }
        return result
    }
    return [this]
}

function jsimport(url, sync) {
    const jsloader=document.createElement('script')
    jsloader.setAttribute("type","text/javascript")
    jsloader.setAttribute("src", url)
    if (!sync)
        jsloader.setAttribute('async', true);
    document.head.appendChild(jsloader)
}
window.jsimport = jsimport

window.__defineGetter__('__FILE__', function() {
  return (new Error).stack.split('/').slice(-1).join().split('?')[0].split(':')[0] +": "
})


const delay = (ms, fn_solver) => new Promise(resolve => setTimeout(() => resolve(fn_solver()), ms));


function _until(fn_solver){
    return async function fwrapper(){
        var argv = Array.from(arguments)
        function solve_me(){return  fn_solver.apply(window, argv ) }
        while (!await delay(16, solve_me ) )
            {};
    }
}
window._until =  _until

function defined(e, o) {
    if (typeof o === 'undefined' || o === null)
        o = window;
    try {
        e = o[e];
    } catch (x) { return false }

    if (typeof e === 'undefined' || e === null)
        return false;
    return true;
}
window.defined = defined

// promise to iterator converter
var prom = {}
var prom_count = 0
window.iterator = function * iterator(oprom) {
    if (prom_count > 32000 ) {
        console.warn("resetting prom counter")
        prom_count = 0
    }

    const mark = prom_count++;
    var counter = 0;
    oprom.then( (value) => prom[mark] = value )
    while (!prom[mark]) {
        yield counter++;
    }
    yield prom[mark];
    delete prom[mark]
}


window.checkStatus = function checkStatus(response) {
    if (!response.ok) {
        response.error =  new Error(`HTTP ${response.status} - ${response.statusText}`);
        return null
    }
    return response;
}


window.addEventListener('unhandledrejection', function(event) {
  console.error("uncaught :",event.promise); // the promise that generated the error
  console.error("uncaught :",event.reason); // the unhandled error object
})


//fileretrieve (binary). TODO: wasm compilation
window.cross_file = function * cross_file(url, store, flags) {
    cross_file.dlcomplete = 1
    var content = 0
    var response = null
    console.log("Begin.cross_file.fetch", url, flags || FETCH_FLAGS )

    fetch(url, flags || FETCH_FLAGS)
        .then( resp => {
                response = resp
                console.log("cross_file.fetch", response.status)
                if (checkStatus(resp))
                    return response.arrayBuffer()
                else {
                    console.warn("got wrong status", response)
                }
            })
        .then( buffer => content = new Uint8Array(buffer) )
        .catch(x => {
                response = { "error" : new Error(x) }
            })

    while (!response)
        yield content

    while (!content && !response.error )
        yield content

    if (response.error) {
        console.warn("cross_file.error :", response.error)
        return response.error
    } else {
        // console.warn("got response", response, "len", response.headers.get("Content-Length"))
    }
    FS.writeFile(store, content )
    console.log("End.cross_file.fetch", store, "r/w=", content.byteLength)
    cross_file.dlcomplete = content.byteLength
    yield store
}




window.cross_dl = async function cross_dl(url, flags) {
    console.log("cross_dl.fetch", url, flags || FETCH_FLAGS )
    const response = await fetch(url, flags || FETCH_FLAGS )
    checkStatus(response)
    console.log("cross_dl len=", response.headers.get("Content-Length") )
    console.log("cross_dl.error", response.error )
    if (response.body) {
        return await response.text()
    } else {
        console.error("cross_dl: no body")
    }
    return ""
}





//urlretrieve
function DEPRECATED_wget_sync(url, store){
    const request = new XMLHttpRequest();
    try {
        request.open('GET', url, false);
        request.send(null);
        if (request.status === 200) {
            console.log(`DEPRECATED_wget_sync(${url})`);
            FS.writeFile( store, request.responseText);
        }
        return request.status
    } catch (ex) {
        return 500;
    }
}

//https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
function is_iframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}


// https://emscripten.org/docs/api_reference/Filesystem-API.html

function prerun(VM) {
    console.warn("VM.prerun")
    // https://github.com/emscripten-core/emscripten/issues/4515
    // VM.FS = FS
    const sixel_prefix = String.fromCharCode(27)+"Pq"

    var buffer_stdout = ""
    var buffer_stderr = ""
    var flushed_stdout = false
    var flushed_stderr = false

    const text_codec = new TextDecoder()

    function b_utf8(s) {
        var ary = []
        for ( var i=0; i<s.length; i+=1 ) {
            ary.push( s.substr(i,1).charCodeAt(0) )
        }
        return text_codec.decode(  new Uint8Array(ary) )
    }

    function stdin() {
        return null
    }

    function stdout(code) {

        var flush = (code == 4)

        if (flush) {
            flushed_stdout = true
        } else {
            if (code == 10) {
                if (flushed_stdout) {
                    flushed_stdout = false
                    return
                }

                buffer_stdout += "\r\n";
                flush = true
            }
            flushed_stdout = false
        }

        if (buffer_stdout != "") {
            if (flush) {
                if (buffer_stdout.startsWith(sixel_prefix)) {
                    console.info("[sixel image]");
                    VM.vt.sixel(buffer_stdout);
                } else {
                    if (buffer_stdout.startsWith("Looks like you are rendering"))
                        return;

                    VM.vt.xterm.write( b_utf8(buffer_stdout) )
                }
                buffer_stdout = ""
                return
            }
        }
        if (!flush)
            buffer_stdout += String.fromCharCode(code);
    }

    function stderr(code) {
        var flush = (code == 4)

        if (flush) {
            flushed_stderr = true
        } else {
            if (code === 10) {
                if (flushed_stderr) {
                    flushed_stderr = false
                    return
                }
                buffer_stderr += "\r\n";
                flush = true
            }
            flushed_stderr = false
        }

        if (buffer_stderr != "") {
            if (flush) {
                if (!VM.vt.nodup)
                    console.log(buffer_stderr);

                VM.vt.xterm.write( b_utf8(buffer_stderr) )
                buffer_stderr = ""
                return
            }
        }
        if (!flush)
            buffer_stderr += String.fromCharCode(code);
    }

    // put script namespace in sys.argv[0]
    // default is org.python
    VM.arguments.push(VM.APK)

    VM.FS.init(stdin, stdout, stderr);

}


async function postrun(VM) {
    console.warn("VM.postrun Begin")
    window.VM = VM
    window.python = VM
    window.py = new bridge(VM)

    var pyrc_url = vm.config.cdn + VM.script.interpreter + "rc.py"

    await fetch(pyrc_url, {})
        .then( response => checkStatus(response) && response.arrayBuffer() )
        .then( buffer => run_pyrc(new Uint8Array(buffer)) )
        .catch(x => {
            console.error("VM.postrun: error:",x)
            console.log("VM.postrun:", pyrc_url)
        })

    console.warn("VM.postrun End")
}



const vm = {
        APK : "org.python",

        arguments: [],

        cpy_argv : [],
        sys_argv : [],

        script : {},

        is_ready : 0,

        DEPRECATED_wget_sync : DEPRECATED_wget_sync,

        vt : {
                xterm : { write : console.log},
                sixel : function(data){ vm.vt.xterm.write(`[sixel:${data && data.length}]\r\n`)},
                nodup : 1
        },

//        canvas: (() => document.getElementById('canvas'))(),

        setStatus : function(text) {
            const statusElement = document.getElementById('status') || {}
            const progressElement = document.getElementById('progress') || {};
            const spinnerElement = document.getElementById('spinner') || { style: {} } ;

            if (text == "hide") {
                progressElement.value = null;
                progressElement.max = null;
                progressElement.hidden = true;
                spinnerElement.style.display = 'none';
                statusElement.innerHTML = "";
                return ;
            }

            if (!this.setStatus.last)
                this.setStatus.last = { time: Date.now(), text: '' };

            if (text === this.setStatus.last.text)
                return;

            var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
            var now = Date.now();
            if (m && now - this.setStatus.last.time < 30)
                return; // if this is a progress update, skip it if too soon
            this.setStatus.last.time = now;
            this.setStatus.last.text = text;
            if (m) {
                text = m[1];
                progressElement.value = ( parseInt(m[2]) / parseInt(m[4]) ) * 100;
                if (progressElement.value>95) {
                    if (progressElement.max>100) {
//TODO: replace by real download progress on .data and wasm instanciation stats.
                        setTimeout( ()=>{ progressElement.value=125 } , 2000)
                        setTimeout( ()=>{ progressElement.value=150 } , 5000)
                        setTimeout( ()=>{ progressElement.value=190 } , 7000)
                    }
                }
                progressElement.hidden = false;
                spinnerElement.hidden = false;
            } else {
                progressElement.value = null;
                progressElement.max = null;
                progressElement.hidden = true;
                if (!text)
                    spinnerElement.style.display = 'none';
            }
            statusElement.innerHTML = text;
        },

        locateFile : function(path, prefix) {
            if (path == "main.data") {
                const url = (config.cdn || "" )+`${vm.script.interpreter}${config.pydigits}/${path}`
                console.log(__FILE__,"locateData: "+path+' '+prefix, "->", url);
                return url;
            } else {
                console.log(__FILE__,"locateFile: "+path+' '+prefix);
            }
            return prefix + path;
        },

        PyRun_SimpleString : function(code) {
            const ud = { "type" : "rcon", "data" : code }
            if (window.worker) {
                window.worker.postMessage({ target: 'custom', userData: ud });
            } else {
                this.postMessage(ud);
            }
        },

        readline : function(line) {
            const ud = { "type" : "stdin", "data" : line }
            if (window.worker) {
                //if (line.search(chr(0x1b)))
                  //  console.log("446: non-printable", line)
                window.worker.postMessage({ target: 'custom', userData: ud });
            } else {
                this.postMessage(ud);
            }
        },

        rawstdin : function (char) {
            const ud = { "type" : "raw", "data" : char }
            if (window.worker) {
                window.worker.postMessage({ target: 'custom', userData: ud });
            } else {
                this.postMessage(ud);
            }
        },

        websocket : { "url" : "wss://" },
        preRun : [ prerun ],
        postRun : [ postrun ]
}


async function run_pyrc(content) {
    const base = "/data/data/org.python/assets/"
    const pyrc_file = base + "pythonrc.py"
    const main_file = base + "__main__.py"
    vm.FS.writeFile(pyrc_file, content )

// embedded canvas
    if (vm.PyConfig.frozen) {
        if ( canvas.dataset.path ) {
            vm.PyConfig.frozen_path = canvas.dataset.src
        } else {
            vm.PyConfig.frozen_path = location.href.rsplit("/",1)  // current doc url as base
        }
        var frozencode = canvas.innerHTML
        if (canvas.dataset.embed) {
            vm.PyConfig.frozen_handler = canvas.dataset.embed
        }
        FS.writeFile(vm.PyConfig.frozen, frozencode)
    } else {
// TODO: concat blocks
        vm.FS.writeFile(main_file, vm.script.blocks[0] )
    }

    python.PyRun_SimpleString(`#!site

__pythonrc__ = "${pyrc_file}"

try:
    __PKPY__
except:
    __PKPY__ = False

if __PKPY__:
    with open(__pythonrc__, "r") as pythonrc:
        exec(pythonrc.read().replace(chr(92)+chr(10),""), globals())

import os
def os_path_is_dir(path):
    try:
        os.listdir(str(path))
        return True
    except:
        return False

def os_path_is_file(path):
    parent, file = str(path).rsplit("/",1)
    try:
        return file in os.listdir(parent)
    except:
        return False

import sys, json
PyConfig = json.loads("""${JSON.stringify(python.PyConfig)}""")
pfx=PyConfig["prefix"]

if not __PKPY__:

    if os_path_is_dir(pfx):
        sys.path.append(pfx)
        os.chdir(pfx)

    del pfx

    try:
        if os_path_is_file(__pythonrc__):
            exec(open(__pythonrc__).read(), globals(), globals())
        else:
            raise Error("File not found")
    except Exception as e:
        print(f"616: invalid rcfile {__pythonrc__}")
        sys.print_exception(e)

    try:
        import asyncio
        asyncio.run(import_site("${main_file}"))
    except ImportError:
        pass
`)

}


function store_file(url, local) {
    fetch(url, {})
        .then( response => checkStatus(response) && response.arrayBuffer() )
        .then( buffer => vm.FS.writeFile(local, new Uint8Array(buffer)) )
        .catch(x => console.error(x))
}

// ===================== DOM features ====================



function feat_gui(debug_hidden) {

    var canvas2d = document.getElementById("canvas")

    function add_canvas(name, width, height) {
        const new_canvas = document.createElement("canvas")
        new_canvas.id = name
        new_canvas.width = width || 1
        new_canvas.height = height || 1
        document.body.appendChild(new_canvas)
        return new_canvas
    }



    if (!canvas2d) {
        canvas2d =  add_canvas("canvas")
        canvas2d.style.position = "absolute"
        canvas2d.style.top = "0px"
        canvas2d.style.right = "0px"
        canvas2d.tabindex = 0
        //var ctx = canvas.getContext("2d")
    } else {
        // user managed canvas
console.warn("TODO: user defined canvas")
    }

    config.user_canvas = config.user_canvas || 0 //??=
    config.user_canvas_managed = config.user_canvas_managed || 0 //??=

    vm.canvas2d = canvas2d

    var canvas3d = document.getElementById("canvas3d")
    if (!canvas3d) {
        canvas3d = add_canvas("canvas3d", 128, 128)
        canvas3d.style.position = "absolute"
        canvas3d.style.bottom = "0px"
        canvas3d.style.left = "0px"

    }
    vm.canvas3d = canvas3d


    canvas.addEventListener("click", MM.focus_handler)
/*



    function event_fullscreen(event){
        if (!event.target.hasAttribute('fullscreen')) return;
        if (document.fullscreenElement) {
            document.exitFullscreen()
        } else {
            document.documentElement.requestFullscreen()
        }
    }
    document.addEventListener('click', event_fullscreen, false);

*/

    // window resize
    function window_canvas_adjust(divider) {
        const canvas = vm.canvas2d
        var want_w
        var want_h

        const ar = canvas.width / canvas.height

        // default is maximize
        var max_width = window.innerWidth
        var max_height = window.innerHeight


        if (vm.config.debug) {
            max_width = max_width * .80
            max_height = max_height * .80
        } else {
            // max_height -= 150
        }

        want_w = max_width
        want_h = max_height


        if (window.devicePixelRatio != 1 )
            console.warn("Unsupported device pixel ratio", window.devicePixelRatio)

        if (vm.config.debug) {
            divider = vm.config.gui_debug
        } else {
            divider = vm.config.gui_divider || 1
        }


        if (vm.config.debug)
            console.log("window[DEBUG]:", want_w, want_h, ar, divider)

        want_w = Math.trunc(want_w / divider )
        want_h = Math.trunc(want_w / ar)


        // constraints
        if (want_h > max_height) {
            if (vm.config.debug)
                console.warn("too tall : have",max_height,"want",want_h)
            want_h = max_height
            want_w = Math.trunc(want_h * ar)
        }

        if (want_w > max_width) {
            if (vm.config.debug)
                console.warn("too wide : have",max_width,"want",want_w)
            want_w = max_width
            want_h = Math.trunc(want_h / ar)
        }


        if (vm.config.debug) {
            canvas.style.margin= "none"
            canvas.style.left = "auto"
            canvas.style.bottom = "auto"
        } else {
            // canvas position is handled by program
            if (vm.config.user_canvas)
                return

            // center canvas
            canvas.style.position = "absolute"
            canvas.style.left = 0
            canvas.style.bottom = 0
            canvas.style.top = 0
            canvas.style.right = 0
            canvas.style.margin= "auto"
        }

        // apply
        canvas.style.width = want_w + "px"
        canvas.style.height = want_h + "px"

        if (vm.config.debug)
            console.log(`window[DEBUG:CORRECTED]: ${want_w}, ${want_h}, ar=${ar}, div=${divider}`)


    }


    function window_canvas_adjust_3d(divider) {
        const canvas = vm.canvas3d
        divider = divider || 1
        if ( (canvas.width==1) && (canvas.height==1) ){
            console.log("canvas context not set yet")
            setTimeout(window_canvas_adjust_3d, 100, divider);
            return;
        }

        if (!vm.config.fb_ar) {
            vm.config.fb_width = canvas.width
            vm.config.fb_height = canvas.height
            vm.config.fb_ar  =  canvas.width / canvas.height
        }


        var want_w
        var want_h

        const ar = vm.config.fb_ar

        const dpr = window.devicePixelRatio
        if (dpr != 1 )
            console.warn("Unsupported device pixel ratio", dpr)

        // default is maximize
        // default is maximize
        var max_width = window.document.body.clientWidth
        var max_height = window.document.body.clientHeight
        want_w = max_width
        want_h = max_height


        if (vm.config.debug)
            console.log("window3D[DEBUG:CORRECTED]:", want_w, want_h, ar, divider)

        // keep fb ratio
        want_w = Math.trunc(want_w / divider )
        want_h = Math.trunc(want_w / ar)

        // constraints
        if (want_h > max_height) {
            //console.warn ("Too much H")
            want_h = max_height
            want_w = Math.trunc(want_h * ar)
        }

        if (want_w > max_width) {
            //console.warn("Too much W")
            want_w = max_width
            want_h = Math.trunc(want_h / ar)
        }

        // restore phy size
        canvas.width  = vm.config.fb_width
        canvas.height = vm.config.fb_height

        canvas.style.position = "absolute"
        canvas.style.top = 0
        canvas.style.right = 0

        if (!vm.config.debug) {
            // center canvas
            canvas.style.left = 0
            canvas.style.bottom = 0
            canvas.style.margin= "auto"
        } else {
            canvas.style.margin= "none"
            canvas.style.left = "auto"
            canvas.style.bottom = "auto"
        }

        // apply viewport size
        canvas.style.width = want_w + "px"
        canvas.style.height = want_h + "px"

        queue_event("resize3d", { width : want_w, height : want_h } )

    }

    function window_resize_3d(gui_divider) {
console.log(" @@@@@@@@@@@@@@@@@@@@@@ 3D CANVAS @@@@@@@@@@@@@@@@@@@@@@")
        setTimeout(window_canvas_adjust_3d, 200, gui_divider);
        setTimeout(window.focus, 300);
    }

    function window_resize_2d(gui_divider) {
        // don't interfere if program want to handle canvas placing/resizing
        if (vm.config.user_canvas_managed)
            return vm.config.user_canvas_managed

        if (!window.canvas) {
            console.warn("777: No canvas defined")
            return
        }

        setTimeout(window_canvas_adjust, 200, gui_divider);
        setTimeout(window.focus, 300);
    }



    function window_resize_event() {
        // special management for 3D ctx
        if (vm.config.user_canvas_managed==3) {
            window_resize(vm.config.gui_divider)
            return
        }
        window_resize(vm.config.gui_divider)
    }

    window.addEventListener('resize', window_resize_event);
    if (vm.config.user_canvas_managed==3)
        window.window_resize = window_resize_3d
    else
        window.window_resize = window_resize_2d

    vm.canvas = canvas2d || canvas3d
    return vm.canvas
}



// file transfer (upload)




function readFileAsArrayBuffer(file, success, error) {
    const fr = new FileReader();
    fr.addEventListener('error', error, false);
    if (fr.readAsBinaryString) {
        fr.addEventListener('load', function () {
            var string = this.resultString != null ? this.resultString : this.result;
            var result = new Uint8Array(string.length);
            for (var i = 0; i < string.length; i++) {
                result[i] = string.charCodeAt(i);
            }
            success(result.buffer);
        }, false);
        return fr.readAsBinaryString(file);
    } else {
        fr.addEventListener('load', function () {
            success(this.result);
        }, false);
        return fr.readAsArrayBuffer(file);
    }
}

function transfer_uploads(files, use_names){
    //global uploaded_file_count = 0
    function transfer_file(frec) {
        return (data) => {
            let pydata = JSON.stringify(frec)
            console.warn("UPLOAD", pydata, frec.text );
            python.FS.writeFile(frec.text, new Int8Array(data) )
            queue_event("upload", pydata )
        }
    }
    for (var i=0;i<files.length;i++) {
        uploaded_file_count++;
        let file = files[i]
        var datapath
        if (use_names){
            datapath = `/tmp/${file.name}`
            //console.log(file.name, file.type, "to", datapath)
        } else {
            datapath = `/tmp/upload-${uploaded_file_count}`
        }

        let frec = {}
            frec["name"] = file.name
            frec["size"] = file.size
            frec["mimetype"] = file.type
            frec["text"] = datapath

        readFileAsArrayBuffer(file, transfer_file(frec), console.error )
    }

}
window.transfer_uploads = transfer_uploads
window.uploaded_file_count = 0

async function feat_fs(debug_hidden) {

    if (!window.BrowserFS) {
        await import_browserfs()
    }


    var dlg_multifile = document.getElementById("dlg_multifile")
    if (!dlg_multifile) {
        dlg_multifile = document.createElement('input')
        dlg_multifile.setAttribute("type","file")
        dlg_multifile.setAttribute("id","dlg_multifile")
        dlg_multifile.setAttribute("multiple",true)
        dlg_multifile.hidden = debug_hidden
        document.body.appendChild(dlg_multifile)
    }

    function dlg_multifile_transfer_uploads(){
        return transfer_uploads(dlg_multifile.files, false)
    }

    dlg_multifile.addEventListener("change", dlg_multifile_transfer_uploads );

}


// js.VT

// simpleterm
async function feat_vt(debug_hidden) {
    var stdio = document.getElementById('stdio')
    if (!stdio){
        stdio = document.createElement('div')
        stdio.id = "stdio"
        stdio.style.width = "640px";
        stdio.style.height = "480px";
        stdio.style.background = "black";
        stdio.style.color = "yellow";
        stdio.innerHTML = "vt100"
        stdio.hidden = debug_hidden
        stdio.setAttribute("tabIndex", 1)
        document.body.appendChild(stdio)
    }

    const { Terminal, helper, handlevt } = await import("./vt.js")

    vm.vt.xterm = new Terminal("stdio", get_terminal_cols(), get_terminal_lines())
    vm.vt.xterm.set_vm_handler(vm, null, null)

    vm.vt.xterm.open()

}

// xterm.js + sixel
async function feat_vtx(debug_hidden) {
    var terminal = document.getElementById('terminal')
    if (!terminal){
        terminal = document.createElement('div')
        terminal.id = "terminal"
        // if running apk only show wrt debug flag, default is hide
        if (vm.config.archive) {
            if (!vm.config.interactive)
                terminal.hidden = debug_hidden
        }

        terminal.style.zIndex = 0
        terminal.setAttribute("tabIndex", 1)
        document.body.appendChild(terminal)
    }

    var console_divider = 1
    const cols = get_terminal_cols()
    var cons = get_terminal_console()
    if (cons<0) {
        console_divider = -cons
        cons = 0
    }

    // --- MODIFICATION START ---
    try {
        const { WasmTerminal } = await import("./vtx.js"); // This is the line that failed
        const lines = get_terminal_lines() + cons;  // including virtual get_terminal_console()
        const py = window.document.body.clientHeight;
        var fntsize = Math.floor(py/lines) - 1;

        if (lines<=33) {
            fntsize = ( fntsize - 5 ) / console_divider;
        }

        console.warn("fnt:",window.document.body.clientHeight ,"/", lines,"=", fntsize, " Cols:", cols, "Cons:", cons);
        vm.vt = new WasmTerminal(
            "terminal",
            cols,
            lines,
            fntsize,
            config.fbdev,
            [
                { url : (config.cdn || "./") + "xtermjsixel/xterm-addon-image-worker.js", sixelSupport:true}
            ]
        );
        console.log("vtx terminal initialized."); // Add success log
    } catch (e) {
        console.error("Failed to load vtx.js. Falling back to simple stdout:", e); // Log the error
        // Fallback to a simpler output method if vtx fails
        // Find the index of 'vtx' and remove it to avoid trying again in the main loop
        const vtxIndex = vm.config.features.indexOf('vtx');
        if (vtxIndex > -1) {
             vm.config.features.splice(vtxIndex, 1);
        }
        // Add 'stdout' if not already present to provide some output mechanism
        if (vm.config.features.indexOf('stdout') === -1) {
             vm.config.features.push('stdout');
             feat_stdout(); // Explicitly call the fallback feature
        } else {
             // If stdout was already a feature, feat_stdout will be called later in onload
             // No need to call it here, just ensure vm.vt.xterm is set up correctly
             if (!vm.vt || !vm.vt.xterm) {
                 feat_stdout();
             }
        }
        // vm.vt will be left as the default { xterm : { write : console.log}, ... }
        return; // Exit feat_vtx
    }
    // --- MODIFICATION END ---
}


// simple <pre> output
function feat_stdout() {
    var stdout = document.getElementById('stdout')
    if (!stdout){
        stdout = document.createElement('pre')
        stdout.id = "stdout"
        stdout.style.whiteSpace = "pre-wrap"
        stdout.hidden = false
        document.body.appendChild(stdout)
    }
    stdout.write = function (text) {
        var buffer = stdout.innerHTML.split("\r\n")
        for (const line of text.split("\r\n") ) {
            if (line.length) {
                buffer.push( line )
            }
        }

        while (buffer.length>25)
            buffer.shift()

        stdout.innerHTML =  buffer.join("\n")

    }
    vm.vt.xterm = stdout // Set vm.vt.xterm to this simple output method
}

// TODO make a queue, python is not always ready to receive those events
// right after page load


function focus_handler(ev) {
    if (!window.canvas)
        return

    if (ev.type == "click") {
        canvas.removeEventListener("click", MM.focus_handler)
        canvas.focus()
        return
    }

    if (ev.type == "mouseenter") {
        console.log("focus set")
        if (MM.focus_lost && MM.current_trackid) {
            console.warn("resuming music queue")
            MM[MM.current_trackid].media.play()
        }
        if (!window.canvas)
            return
        canvas.focus()
        canvas.removeEventListener("mouseenter", MM.focus_handler)
        return
    }

    if (ev.type == "focus") {
        if (!window.canvas)
            return
        queue_event("focus", ev )
        console.log("focus set")
        canvas.focus()
        return
    }

    // for autofocus
    if (ev.type == "blur") {
        if (!window.canvas)
            return
        // remove initial focuser that may still be there
        try {
            canvas.removeEventListener("click", MM.focus_handler)
        } catch (x ) {}

        canvas.addEventListener("click", MM.focus_handler)
        canvas.addEventListener("mouseenter", MM.focus_handler)
        queue_event("blur", ev )
        return
    }
}


function feat_lifecycle() {
        window.addEventListener("focus", MM.focus_handler)
        window.addEventListener("blur", MM.focus_handler)

        if (!vm.config.can_close) {
            window.onbeforeunload = function() {
                console.warn("window.onbeforeunload")
                if (MM.current_trackid) {
                    console.warn("pausing music queue")
                    MM.focus_lost = 1
                    MM[MM.current_trackid].media.pause()
                } else {
                    console.warn("not track playing")
                }
                const message = "Are you sure you want to navigate away from this page ?"
                if (confirm(message)) {
                    return message
                } else {
                    return false
                }
            }
        }
}


function feat_snd() {
    // to set user media engagement status and possibly make it blocking
    MM.UME = !vm.config.ume_block
    MM.is_safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (!MM.is_safari)
        MM.is_safari = navigator.userAgent.search("iPhone")>=0;

    if (!MM.UME) {
        if (MM.is_safari) {
            console.warn("safari ume unlocking")
            MM.is_safari = function unlock_ume() {
                MM.UME = 1
                window.removeEventListener("click", MM.is_safari)
                MM.is_safari = 1
            }
            window.addEventListener("click", MM.is_safari)
        } else {
            console.warn("Auto ume unlocker safari==", MM.is_safari)
            MM_play( {auto:1, test:1, media: new Audio(config.cdn+"empty.ogg")} , 1)
        }
    } else {
        console.warn("NO ume unlocker, safari ==", MM.is_safari)
    }
}

// ============================== event queue =============================

window.EQ = []


function queue_event(evname, data) {
    const jsdata = JSON.stringify(data)
    EQ.push( { name : evname, data : jsdata} )

    if (window.python && window.python.is_ready && vm.vt && vm.vt.xterm) { // Check if vt and xterm are ready
        while (EQ.length>0) {
            const ev = EQ.shift()
            python.PyRun_SimpleString(`#!
__EMSCRIPTEN__.EventTarget.build('${ev.name}', '''${ev.data}''')
`)
        }
    } else {
        // Output queued events to console if terminal is not ready
        console.warn(`Event "${evname}" queued : terminal not ready yet`, data);
    }
}

// js.MM
// =============================  media manager ===========================

// js.MM.download
function download(diskfile, filename) {
    if (!filename)
        filename = diskfile.rsplit("/").pop()

    const blob = new Blob([FS.readFile(diskfile)])
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob, { oneTimeOnly: true });
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
}



window.MM = {
    tracks : 0,
    trackid_current : 0,
    next : "",
    next_hint : "",
    next_loops : 0,
    next_tid : 0,
    transition : 0,
    UME : true,
    download : download,
    focus_lost : 0,
    focus_handler : focus_handler,
    camera : {}
}

async function media_prepare(trackid) {
    const track = MM[trackid]


    await _until(defined)("avail", track)

    if (track.type === "audio") {
        //console.log(`audio ${trackid}:${track.url} ready`)
        return
    }

    if (track.type === "fs") {
        console.log(`fs ${trackid}:${track.url} => ${track.path} ready`)
        return
    }


    if (track.type === "mount") {

        if (!window.BrowserFS) { // Use window.BrowserFS check
            await import_browserfs()
        }

        // how is passed the FS object ???
        // Ensure vm.BFS is initialized only once after BrowserFS is available
        if (!vm.BFS) {
             vm.BFS = new BrowserFS.EmscriptenFS() // {FS:vm.FS} // EmscriptenFS expects FS to be globally available or passed
             // Assuming BrowserFS is globally available after import_browserfs
             if (window.BrowserFS && window.BrowserFS.BFSRequire) {
                vm.BFS.Buffer = window.BrowserFS.BFSRequire('buffer').Buffer;
             } else {
                 console.error("BrowserFS or BFSRequire not available after import!");
                 // Handle error: Maybe fallback or throw
                 track.error = true; // Mark track as error
                 track.avail = true; // Mark as 'checked' even if error
                 return; // Stop processing this mount track
             }
        }


        // async
        MM[trackid].media = await vm.BFS.Buffer.from( MM[trackid].data )

        track.mount.path = track.mount.path || '/' //??=

        const hint = `${track.mount.path}@${track.mount.point}:${trackid}`

        // No need to check vm.BFS again here, it's checked above

        const track_media = MM[trackid].media

        if (!bfs2) {
            console.warn(" ==================== BFS1 ===============")
            // Check if BrowserFS components are available before using
            if (!window.BrowserFS || !BrowserFS.FileSystem || !BrowserFS.FileSystem.InMemory || !BrowserFS.FileSystem.OverlayFS || !BrowserFS.FileSystem.MountableFileSystem || !BrowserFS.FileSystem.ZipFS) {
                 console.error("BrowserFS FileSystem components not available for BFS1 init!");
                 track.error = true; track.avail = true; return; // Handle error
            }
            BrowserFS.InMemory = BrowserFS.FileSystem.InMemory
            BrowserFS.OverlayFS = BrowserFS.FileSystem.OverlayFS
            BrowserFS.MountableFileSystem = BrowserFS.FileSystem.MountableFileSystem
            BrowserFS.ZipFS = BrowserFS.FileSystem.ZipFS

            function apk_cb(e, apkfs){
                 if (e) {
                     console.error("BrowserFS ZipFS Create Error:", e);
                     track.error = true; track.avail = true; return; // Handle error in callback
                 }
                console.log(__FILE__, "1225: mounting", hint, "onto", track.mount.point)

                BrowserFS.InMemory.Create(
                    function(e, memfs) {
                         if (e) { console.error("BrowserFS InMemory Create Error:", e); track.error = true; track.avail = true; return; }
                        BrowserFS.OverlayFS.Create({"writable" :  memfs, "readable" : apkfs },
                            function(e, ovfs) {
                                 if (e) { console.error("BrowserFS OverlayFS Create Error:", e); track.error = true; track.avail = true; return; }
                                BrowserFS.MountableFileSystem.Create({
                                    '/' : ovfs
                                    }, async function(e, mfs) {
                                         if (e) { console.error("BrowserFS MountableFileSystem Create Error:", e); track.error = true; track.avail = true; return; }
                                        try {
                                            await BrowserFS.initialize(mfs)
                                            await vm.FS.mount(vm.BFS, {root: track.mount.path}, track.mount.point)
                                            console.log("1236: mount complete")
                                            setTimeout(()=>{track.ready=true; track.avail=true;}, 0) // Set avail to true on success
                                        } catch (mountError) {
                                            console.error("BrowserFS Mount/Initialize Error:", mountError);
                                            track.error = true; track.avail = true; // Set avail to true even on mount error
                                        }
                                    })
                            }
                        );
                    }
                );
            }

             try {
                await BrowserFS.ZipFS.Create(
                    {"zipData" : track_media, "name": hint},
                    apk_cb // apk_cb is async, but Create might not await it internally
                );
                 // Note: ZipFS.Create calls apk_cb asynchronously. track.avail is set inside apk_cb.
             } catch (zipError) {
                 console.error("BrowserFS ZipFS Create Error (initial):", zipError);
                 track.error = true; track.avail = true; // Set avail to true on initial error
             }


        } else { // bfs2
            console.warn(" ==================== BFS2 ===============")
             if (!window.BrowserFS || !BrowserFS.configure) {
                 console.error("BrowserFS or BrowserFS.configure not available for BFS2 init!");
                 track.error = true; track.avail = true; return; // Handle error
             }

            try {
                // assuming FS is from Emscripten
                await BrowserFS.configure({
                    fs: 'MountableFileSystem',
                    options: {
                        '/': {
                            fs: 'OverlayFS',
                            options: {
                                readable: { fs: 'ZipFS', options: { zipData: track_media, name: 'hint'  } },
                                writable: { fs: 'InMemory' }
                            }
                        }
                    }
                });

                await vm.FS.mount(vm.BFS, { root: track.mount.path, }, track.mount.point);
                console.log("BFS2 mount complete"); // Add success log
                setTimeout(()=>{track.ready=true; track.avail=true;}, 0); // Set avail to true on success
            } catch (bfs2Error) {
                 console.error("BrowserFS BFS2 configure/mount Error:", bfs2Error);
                 track.error = true; track.avail = true; // Set avail to true on error
            }
        } // bfs2

    } // track type mount
    // For types other than 'mount', avail is set when data is received or deemed available (like audio URLs or FS files)
    // Ensure avail is always set eventually, even on errors during fetching/processing
    if (track.avail === undefined) {
         // This might happen if fetching failed or type was unsupported
         console.warn(`Track ${trackid} (${track.url}) preparation finished without setting avail status.`);
         track.avail = true; // Assume ready state for checking, error flag will indicate failure
    }
}


function MM_play(track, loops) {
    // Check if track exists and has media
    if (!track || !track.media) {
        console.error("MM_play called with invalid track or missing media:", track);
        return;
    }

    const media = track.media
    track.loops = loops
    const prom = track.media.play()
    if (prom){
        prom.then(() => {
            // ME ok play started
            MM.UME = true
             console.log(`Track ${track.trackid} started playing.`); // Add success log
        }).catch(error => {
            // Media engagement required
            MM.UME = false
            console.error(`** MEDIA USER ACTION REQUIRED [${track.test || 'auto-play'}] **:`, error); // Log the error
            if (track.test && track.test>0) {
                track.test += 1
                setTimeout(MM_play, 2000, track, loops)
            } else if (track.auto && MM.is_safari) { // Specific handling for Safari auto-play blocks
                 console.warn("Safari auto-play blocked. Waiting for user interaction.");
                 // You might want to add an event listener here to try playing again on user click/tap
                 // window.addEventListener('click', () => { if (!MM.UME) { MM_play(track, loops); } }, { once: true });
            }

        });
    }
}




window.cross_track = async function cross_track(trackid, url, flags) {
    const track = MM[trackid];
     if (!track) {
         console.error("cross_track called with invalid trackid:", trackid);
         return; // Exit if track doesn't exist
     }

    var response = null;
     try {
        response = await fetch(url, flags || FETCH_FLAGS);
        if (!checkStatus(response)) {
             console.error(`Fetch failed for track ${trackid}: HTTP ${response.status} - ${response.statusText}`);
             track.error = new Error(`HTTP ${response.status} - ${response.statusText}`); // Store the error
             track.avail = true; // Mark as processed (with error)
             return track.error; // Return error
        }
     } catch (fetchError) {
         console.error(`Fetch Exception for track ${trackid} (${url}):`, fetchError);
         track.error = fetchError; // Store the error
         track.avail = true; // Mark as processed (with error)
         return fetchError; // Return error
     }


    const reader = response.body.getReader();

    const len_header = response.headers.get("Content-Length");
    const len = len_header ? Number(len_header) : 0; // Handle missing Content-Length
     if (len === 0 && len_header !== null) {
         console.warn(`Track ${trackid} (${url}): Content-Length is 0 or header missing. Proceeding anyway.`);
     }


    // concatenate chunks into single Uint8Array
     let chunks = [];
     let receivedLength = 0;

    console.warn(`Downloading track ${trackid} from ${url}...`);

    while(true) {
         try {
            const {done, value} = await reader.read();

            if (done) {
                 break;
            }
            chunks.push(value);
            receivedLength += value.length;
             // Optional: Add progress reporting here if needed
             // console.log(`Track ${trackid}: Received ${receivedLength} of ${len || '?'}`);
         } catch (readError) {
             console.error(`Error reading stream for track ${trackid} (${url}):`, readError);
             track.error = readError; // Store the error
             track.avail = true; // Mark as processed (with error)
             return readError; // Return error
         }
    }

     // Concatenate all chunks into a single Uint8Array
     track.data = new Uint8Array(receivedLength);
     let offset = 0;
     for (const chunk of chunks) {
         track.data.set(chunk, offset);
         offset += chunk.length;
     }

     track.pos = receivedLength; // Final position is total length
     track.len = len > 0 ? len : receivedLength; // Use header length if available, otherwise actual received length

    console.log(`${trackid}:${url} Received ${track.pos} bytes. Storing to ${track.path || 'memory'}`);
     // Check if data was actually received
     if (track.pos === 0 && receivedLength > 0) {
          console.warn(`Track ${trackid}: receivedLength > 0 but track.pos is 0? Check logic.`);
     }
     if (track.pos === 0 && receivedLength === 0 && len_header !== "0") {
         console.error(`Track ${trackid}: Downloaded 0 bytes for ${url}.`);
         track.error = new Error(`Downloaded 0 bytes for ${url}`);
     }


    if (track.type === "fs" ) {
         try {
            FS.writeFile(track.path, track.data);
             console.log(`Track ${trackid} stored to FS at ${track.path}`);
         } catch (fsError) {
             console.error(`Error writing track ${trackid} to FS at ${track.path}:`, fsError);
             track.error = fsError; // Store FS error
         }
    }

    track.avail = true; // Mark as processed (success or failure)
    return track.error || trackid; // Return error object or trackid on success
}


MM.prepare = function prepare(url, cfg) {
    MM.tracks++;
    const trackid = MM.tracks
    var audio

    try {
        cfg = JSON.parse(cfg);
    } catch (e) {
         console.error(`Failed to parse track config for URL ${url}:`, e);
         MM[trackid] = {"trackid": trackid, "error": e, "avail": true}; // Mark as failed immediately
         return MM[trackid];
    }


    const transport = cfg.io || 'packed'
    const type = cfg.type || 'fs'

    MM[trackid] = { ...cfg, ...{
            "trackid": trackid,
            "type"  : type,
            "url"   : url,
            "error" : false, // Reset error flag
            "len"   : 0,
            "pos"   : 0,
            "io"    : transport,
            "ready" : undefined, // ready state, e.g. for audio canplaythrough
            "auto"  : cfg.auto || false, // Keep auto flag from config
            "avail" : undefined, // avail means data is fully downloaded/processed
            "media" : undefined,
            "data"  : undefined // Raw data buffer
        }
    }
    const track = MM[trackid]

//console.log("MM.prepare", trackid, transport, type)

    if (transport === 'fs') {
        // For 'fs' transport, data is assumed to be already in FS
        // Need to check if the file exists or handle FS read errors later
         if (type === "audio") {
             try {
                const blob = new Blob([FS.readFile(track.url)]) // Read from FS
                audio = new Audio(URL.createObjectURL(blob,  { oneTimeOnly: true }))
                track.avail = true // Data is locally available in FS
                track.path = track.url; // For FS type, path is the url
             } catch (fsReadError) {
                 console.error(`Failed to read FS audio file ${track.url}:`, fsReadError);
                 track.error = fsReadError;
                 track.avail = true; // Mark as processed (with error)
             }
         } else if (type === 'mount') {
             // Mount from FS file - data is in the FS file itself
              track.path = track.url; // FS file path
              // Need to read the file into memory/buffer before mounting
              try {
                  track.data = new Uint8Array(FS.readFile(track.path)); // Read binary data
                  track.avail = true; // Data read from FS
              } catch (fsReadError) {
                   console.error(`Failed to read FS file ${track.url} for mounting:`, fsReadError);
                   track.error = fsReadError;
                   track.avail = true; // Mark as processed (with error)
              }
         }
         else {
            console.error(`FS transport is only fully implemented for 'audio' and 'mount' types. Type '${type}' unsupported via 'fs' transport.`);
            track.error = new Error(`Unsupported type '${type}' for 'fs' transport`);
            track.avail = true; // Mark as processed (with error)
         }
    } else if (transport === "url" ) {
        // audio tag can download itself
        if ( type === "audio" ) {
            audio = new Audio(url)
            track.avail = true // Audio tag handles download, so it's 'available' to the browser Media API
        } else if (type === "fs" || type === "mount") {
             // Need to fetch data from URL and save to track.data or FS
             track.path = cfg.path || `/tmp/mm_track_${trackid}`; // Define a default path if not provided
             console.log(`Fetching track ${trackid} data from URL ${url} to ${track.path}`);
             cross_track(trackid, url, {} ) // This is async and will set track.avail later
        }
         else {
              console.error(`URL transport unsupported for type '${type}'.`);
              track.error = new Error(`Unsupported type '${type}' for 'url' transport`);
              track.avail = true; // Mark as processed (with error)
         }
    } else {
        console.error(`Unsupported transport '${transport}' for track ${trackid}.`);
        track.error = new Error(`Unsupported transport '${transport}'`);
        track.avail = true; // Mark as processed (with error)
    }


    if (audio) {
        track.media = audio

        track.set_volume = (v) => { track.media.volume = 0.0 + v }
        track.get_volume = () => { return track.media.volume }
        track.stop = () => { track.media.pause() }

        track.play = (loops) => { MM_play( track, loops) }

        MM_autoevents(track, trackid)

    }

//console.log("MM.prepare", url,"queuing as",trackid)
    // Wait for track.avail to become true before calling media_prepare logic (mostly for mount)
    // For audio/fs where avail is set sync, this awaits immediate promise
     _until(defined)("avail", track).then(() => {
         if (!track.error) { // Only proceed if no error during initial processing/fetching
              media_prepare(trackid);
         } else {
              console.error(`Skipping media_prepare for track ${trackid} due to previous error.`);
              track.ready = false; // Ensure ready is false if error occurred
         }
     });
//console.log("MM.prepare", url,"queued as",trackid)
    return track
}


MM.load = function load(trackid, loops) {
// loops =0 play once, loops>0 play number of time, <0 loops forever
    const track = MM[trackid]
    if (!track) {
         console.error("MM.load called with invalid trackid:", trackid);
         return -1; // Indicate error
    }

    if (track.error) {
         console.error(`MM.load: Track ${trackid} had an error during preparation.`);
         return -1; // Indicate error
    }


    loops = loops || 0 //??=
    track.loops = loops

    // Note: This function seems redundant for 'audio' type as MM.prepare already sets up the audio object.
    // It seems primarily designed for 'mount' type after data is fetched.

    if (track.type === "audio") {
        // MM_autoevents is already called in MM.prepare for audio
         if (!track.media) {
              console.error(`MM.load: Audio track ${trackid} is missing media object.`);
              return -1;
         }
         console.log(`MM.load: Audio track ${trackid} ready.`);
        return trackid
    }

    if (track.type === "mount") {
        // This part seems intended to be called *after* data is fetched (track.avail is true)
        // The actual mounting logic is inside media_prepare for type 'mount'
        // So, if MM.load is called *before* media_prepare for a mount track completes,
        // it will incorrectly report -1 or proceed with incomplete data.
        // Let's check if media_prepare has completed (indicated by track.avail)
         if (!track.avail) {
             console.warn(`MM.load: Mount track ${trackid} data not yet available.`);
             // You might want to queue the load or return a pending status
             return 0; // Indicate pending/not ready
         }
         if (!track.ready) {
             console.warn(`MM.load: Mount track ${trackid} is available but not yet ready for mounting.`);
             // Wait for track.ready which is set after BFS mount
             return 0; // Indicate pending/not ready
         }

        // If track.ready is true, mounting should be complete.
        console.log(`MM.load: Mount track ${trackid} at ${track.mount.point} from ${track.mount.path} ready.`);
        return trackid
    }

    // unsupported type via MM.load
    console.error(`MM.load: Unsupported type '${track.type}'.`);
    return -1
}


MM.play = function play(trackid, loops, start, fade_ms) {
    console.log("MM.play",trackid, loops, MM[trackid] )
    const track = MM[trackid]
     if (!track) {
         console.error("MM.play called with invalid trackid:", trackid);
         return;
     }
     if (track.error) {
         console.error(`MM.play: Cannot play track ${trackid} due to previous error.`);
         return;
     }


    track.loops = loops
     // start and fade_ms are ignored by the current Audio logic

     if (track.type !== "audio") {
         console.error(`MM.play: Cannot play non-audio track type '${track.type}'.`);
         return;
     }

    if (track.ready && track.media) {
        track.media.play()
         console.log(`Attempting to play track ${trackid}.`);
    } else {
        console.warn(`Cannot play track ${trackid} immediately (ready=${track.ready}, media=${!!track.media}). Will retry.`);
        // This retry logic is also inside MM_play itself now (for UME)
        // But the `play_asap` here was intended for `track.ready` specifically. Let's keep it for robustness.
        function play_asap() {
            // Re-check track validity and readiness
            if (MM[trackid] && MM[trackid].ready && MM[trackid].media) {
                MM[trackid].media.play();
                 console.log(`Retry playing track ${trackid} successful.`);
            } else {
                console.warn(`Retry playing track ${trackid} failed (ready=${MM[trackid]?.ready}, media=${!!MM[trackid]?.media}). Retrying in 500ms.`);
                setTimeout(play_asap, 500)
            }
        }
        play_asap()
    }
}

MM.stop = function stop(trackid) {
    console.log("MM.stop", trackid, MM[trackid] )
     const track = MM[trackid];
     if (track && track.media && track.type === "audio") { // Only stop audio tracks this way
        track.media.currentTime = 0
        track.media.pause()
     } else if (!track) {
         console.warn("MM.stop called with invalid trackid:", trackid);
     } else {
         console.warn(`MM.stop does not support track type '${track.type}'.`);
     }
    if (MM.current_trackid === trackid) {
        MM.current_trackid = 0
    }
}

MM.get_pos = function get_pos(trackid) {
    if (MM.transition)
        return 0

    const track = MM[trackid]

    if (track && track.media && track.type === "audio") // Only audio has currentTime
        return MM[trackid].media.currentTime
    return -1
}



MM.pause = function pause(trackid) {
    console.log("MM.pause", trackid, MM[trackid] )
     const track = MM[trackid];
     if (track && track.media && track.type === "audio") { // Only pause audio tracks
        MM[trackid].media.pause()
     } else if (!track) {
         console.warn("MM.pause called with invalid trackid:", trackid);
     } else {
         console.warn(`MM.pause does not support track type '${track.type}'.`);
     }
}

MM.unpause = function unpause(trackid) {
    console.log("MM.unpause", trackid, MM[trackid] )
     const track = MM[trackid];
     if (track && track.media && track.type === "audio") { // Only unpause audio tracks
        MM.current_trackid = trackid
        MM[trackid].media.play()
     } else if (!track) {
         console.warn("MM.unpause called with invalid trackid:", trackid);
     } else {
         console.warn(`MM.unpause does not support track type '${track.type}'.`);
     }
}

MM.set_volume = function set_volume(trackid, vol) {
    console.log(`MM.set_volume track=${trackid} vol=${vol}`)
     const track = MM[trackid];
     if (track && track.media && track.type === "audio") { // Only set volume on audio
        MM[trackid].media.volume = 1 * vol
     } else if (!track) {
         console.warn("MM.set_volume called with invalid trackid:", trackid);
     } else {
         console.warn(`MM.set_volume does not support track type '${track.type}'.`);
     }
}

MM.get_volume = function get_volume(trackid) { // Removed 'vol' param as it's a getter
    console.log(`MM.get_volume track=${trackid}`)
    const track = MM[trackid];
     if (track && track.media && track.type === "audio") {
        return MM[trackid].media.volume
     } else if (!track) {
         console.warn("MM.get_volume called with invalid trackid:", trackid);
     } else {
         console.warn(`MM.get_volume does not support track type '${track.type}'.`);
     }
    return -1; // Indicate error or not applicable
}

MM.set_socket = function set_socket(mode) {
    vm["websocket"]["url"] = mode
    console.log("WebSocket default mode is now :", mode)
}


function MM_autoevents(track, trackid) {
    // Ensure track and media exist and it's an audio type before adding listeners
    if (!track || !track.media || track.type !== "audio") {
        console.warn(`Skipping MM_autoevents setup for track ${trackid} (Not audio or media missing).`);
        return;
    }

    const media = track.media

    if (media.MM_autoevents) {
        return // Avoid adding listeners multiple times
    }

    media.MM_autoevents = 1 // Mark as setup

    media.onplaying = (event) => {
        MM.transition = 0
        MM.current_trackid = trackid
         console.log(`Track ${trackid} is now playing.`);
    }

    media.addEventListener("canplaythrough", (event) => {
        track.ready = true
         console.log(`Track ${trackid} can play through.`);
        if (track.auto) {
             console.log(`Track ${trackid} auto-playing.`);
            media.play()
        }
    })

    media.addEventListener('ended', (event) => {
        console.log(`Track ${trackid} ended. Loops left: ${track.loops}`);

        if (track.loops < 0) {
            console.log("Track ended - looping forever");
            media.currentTime = 0; // Reset time for seamless loop
            media.play();
            return
        }
        if (track.loops > 0) {
            track.loops--;
            console.log("Track ended - remaining loops:", track.loops);
             media.currentTime = 0; // Reset time for next loop
            media.play();
            return
        }

        console.log("Track ended - checking queue.", MM.next_tid ? `Next queued: ${MM.next_tid}` : "Queue is empty.");

        // check a track is queued
        if (MM.next_tid) {
            MM.transition = 1
            console.log("Playing queued track", MM.next_hint, "from", MM.next, "loops", MM.next_loops);
            // The next track should ideally be prepared/loaded already.
            // Set auto=true on the *next* track if needed, then call play on it.
            const nextTrack = MM[MM.next_tid];
            if (nextTrack) {
                 nextTrack.auto = true; // Ensure the next track auto-plays when ready
                 MM.play(MM.next_tid, MM.next_loops); // Call play on the next track
            } else {
                 console.error(`Queued track ID ${MM.next_tid} not found in MM.`);
            }
            MM.next_tid = 0; // Clear the queue marker
            MM.next_hint = "";
            MM.next_loops = 0;
        } else {
             MM.current_trackid = 0; // No next track, clear current
             console.log("Track ended, queue empty.");
        }
    })

    // Add error listener for media elements
    media.addEventListener('error', (event) => {
        console.error(`Media playback error for track ${trackid} (${track.url}):`, media.error, event);
        track.error = new Error(`Media error code ${media.error.code}: ${media.error.message}`);
        // Depending on the error, you might want to try the next track or mark this one as permanently failed.
        MM.current_trackid = 0; // Clear current track on error
        // Optionally check MM.next_tid and try to play it
    });
}


// js.MM.CAMERA

// TODO: https://ffmpegwasm.netlify.app/ https://github.com/ffmpegwasm
// TODO: write png in a wasm pre allocated array
// TODO: frame rate

window.MM.camera.started = 0
window.MM.camera.init = function * (device_path, width,height, preview, grabber) {
     // Check if camera is already started
     if (MM.camera.started > 0) {
         console.warn("Camera already started.");
         yield window.MM.camera.started; // Yield current state
         return; // Exit generator
     }
    if (MM.camera.started === -1) {
         console.error("Camera failed to start previously.");
         yield MM.camera.started; // Yield error state
         return; // Exit generator
    }

    var done = 0;
    var rc = null; // This variable is unused

    const vidcap = document.createElement('video');
    vidcap.id = "vidcap";
    vidcap.autoplay = true;
    vidcap.muted = true; // Mute video element usually needed for autoplay policies

    window.vidcap = vidcap;
    width = width || 640;
    height = height || 480;

    vidcap.width = width;
    vidcap.height = height;
    const device = device_path || "/dev/video0"; // Use provided path or default


    MM.camera.fd = {}; // File descriptor placeholder? Unused in this JS logic.
    MM.camera.busy = 0; // Frame grabber busy counter

    // Frame rate calculation (target 30 fps, grabbing every ~8ms? Seems too fast)
    // 1000ms / 30fps = ~33.3ms per frame.
    // Let's set a reasonable interval, maybe grab 10-15 times per second?
    // Number.parseInt(1000 / target_fps)
    const target_fps = 15; // Grab 15 frames per second
    MM.camera.frame = { device : undefined , rate : Number.parseInt(1000 / target_fps) }; // Interval in ms


    var framegrabber = null; // Canvas for grabbing frames

    // Decide where to put video/canvas elements
    const outputContainer = document.getElementById('html') || document.body; // Or specify a div
    if (outputContainer) {
        if (preview) {
             // Style for preview might be needed (position, size, etc.)
            outputContainer.appendChild(vidcap);
             vidcap.style.display = debug_hidden ? 'none' : ''; // Hide if debug_hidden is true
             console.log(`Video preview added to ${outputContainer.id || 'body'}`);
        }

        if (grabber) { // If a separate grabber canvas is needed visually
            framegrabber = document.createElement('canvas');
             framegrabber.id = "framegrabber_canvas";
             // Style for grabber canvas might be needed
            outputContainer.appendChild(framegrabber);
             framegrabber.style.display = debug_hidden ? 'none' : ''; // Hide if debug_hidden is true
             console.log(`Grabber canvas added to ${outputContainer.id || 'body'}`);
        }
    } else {
         console.warn("No output container found (#html), video/canvas elements will not be added to DOM.");
    }


    // Use OffscreenCanvas if no visual grabber needed, or if browser supports it well
    if (!framegrabber) {
        try {
             // Check if OffscreenCanvas is supported and works in this context
             // Note: OffscreenCanvas might have limitations with drawImage from video in some workers/contexts
             // For main thread, a hidden HTMLCanvasElement is often safer if OffscreenCanvas issues arise.
             framegrabber = new OffscreenCanvas(width, height);
             console.log("Using OffscreenCanvas for frame grabbing.");
        } catch (e) {
             console.warn("OffscreenCanvas not supported or failed, falling back to hidden HTMLCanvasElement:", e);
             framegrabber = document.createElement('canvas');
             framegrabber.width = width;
             framegrabber.height = height;
             framegrabber.style.display = 'none'; // Keep it hidden
             document.body.appendChild(framegrabber); // Add to body even if hidden
        }
    } else { // If grabber canvas was explicitly created in DOM
        framegrabber.width = width;
        framegrabber.height = height;
    }


    window.framegrabber = framegrabber; // Make it accessible for debugging


    // Status check for frame readiness in the FS (might be used by Python)
    MM.camera.query_image = function () {
        // Check if a frame file exists at the device path.
        // This assumes GRABBER saves frames to this path.
        // Alternatively, you could check MM.camera.frame[device] status directly.
        try {
            return FS.analyzePath(device).exists;
        } catch (e) {
            // FS might not be ready or path analysis failed
             console.warn(`FS analyzePath failed for ${device}:`, e);
            return false;
        }
    };

    // Generator to get raw frame data (intended for Python via iterators)
    MM.camera.get_raw = function * () {
        // Request a new frame capture if not busy
         if (MM.camera.busy === 0) {
             // Schedule GRABBER to capture the *next* frame
             console.log("Requesting new camera frame capture.");
             MM.camera.busy++; // Indicate a capture is in progress
             GRABBER(); // GRABBER will decrement busy when done
         } else {
              console.warn(`Camera grabber busy (${MM.camera.busy}), waiting for current frame.`);
         }

        // Wait until a new frame is available at the device path (written by GRABBER)
        // This assumes GRABBER writes to FS immediately after capture/encoding.
         let frame_available_in_fs = false;
         while (!frame_available_in_fs) {
             try {
                 frame_available_in_fs = FS.analyzePath(device).exists;
             } catch (e) {
                 // FS might not be ready or path issue
                 console.warn(`Waiting for FS path ${device}:`, e);
                 frame_available_in_fs = false;
             }
             if (!frame_available_in_fs) {
                yield 0; // Yield control while waiting
             }
         }

         // Once the file exists, read it and yield the data.
         // The FS.readFile returns a Uint8Array, which matches the common 'raw' data expectation.
         try {
             const frame_data = FS.readFile(device);
             console.log(`Camera frame read from ${device}, size: ${frame_data.length}`);
             // After reading, perhaps remove the file to signal it's consumed and allow the next GRABBER cycle?
             // FS.unlink(device); // Be careful with this, ensure Python side is done with it.
             yield frame_data; // Yield the frame data
         } catch (fsReadError) {
             console.error(`Failed to read camera frame from FS at ${device}:`, fsReadError);
             yield null; // Yield null or throw to indicate failure
         }
    }

    const reader = new FileReader(); // Used for reading Blob data

    reader.addEventListener("loadend", () => { // Use loadend to handle both success and error
            if (reader.error) {
                 console.error("FileReader error reading camera frame blob:", reader.error);
                 // Handle the error, maybe mark camera as failed temporarily or permanently
                 MM.camera.busy--; // Decrement busy counter even on error
                 // How to signal failure to Python waiting on get_raw? The generator awaits FS.analyzePath(device).exists, which won't be true.
                 // We need a way to signal failure to the generator waiting in the `while (!frame_available_in_fs)` loop.
                 // A simple approach is to set an error flag or return value on MM.camera.frame or similar.
                 MM.camera.frame[device] = -1; // Use -1 to indicate an error occurred writing to FS
                 return;
            }
            const data = new Uint8Array(reader.result);
             try {
                FS.writeFile(device, data); // Write the frame data to the virtual FS path
                //console.log("frame ready at ", MM.camera.busy);
                MM.camera.frame[device] = data.length; // Signal success by setting length (used by old logic, maybe keep?)
                MM.camera.busy--; // Decrement busy counter
                 console.log(`Camera frame successfully written to FS at ${device}.`);
             } catch (fsWriteError) {
                 console.error(`Error writing camera frame to FS at ${device}:`, fsWriteError);
                 MM.camera.frame[device] = -1; // Signal FS write error
                 MM.camera.busy--; // Decrement busy counter
             }

        }, false
    );

    // Function to capture frame from video and save to FS
    async function GRABBER() {
        // Ensure GRABBER isn't called again immediately if busy
        if (MM.camera.busy > 0) {
             // If busy, GRABBER will be scheduled again by the `setTimeout` loop if still running.
             // No need to schedule here.
            return;
        }

        // Schedule the *next* capture
        if (MM.camera.started > 0) { // Only schedule if camera is started successfully
            setTimeout(GRABBER, MM.camera.frame["rate"]);
        } else {
             console.log("GRABBER stopping: Camera not started or failed.");
             return; // Stop scheduling if camera isn't running
        }


        // Ensure video is ready and playable
        if (!vidcap || vidcap.readyState < 2 /* HAVE_CURRENT_DATA */) {
             console.warn("Video element not ready for grabbing yet.");
             return; // Skip this grab cycle if video is not ready
        }

        MM.camera.busy++; // Increment busy counter *before* async operations

        try {
            const ctx = framegrabber.getContext("2d");
             // Ensure canvas size matches video size for drawing
            ctx.drawImage(vidcap, 0, 0, framegrabber.width, framegrabber.height);

            // Convert the drawn canvas content to a Blob
             MM.camera.blob = await framegrabber.convertToBlob({type:"image/png"}); // Use PNG for lossless or 'image/jpeg' for compressed

            // Read the Blob into an ArrayBuffer and trigger the reader 'loadend' event
            reader.readAsArrayBuffer(MM.camera.blob);

            // The busy counter decrement and FS write happen in the reader's loadend event handler.

        } catch (grabError) {
             console.error("Error during camera frame grabbing or blob conversion:", grabError);
             MM.camera.busy--; // Decrement busy counter on error
             MM.camera.frame[device] = -1; // Signal grab/conversion error
        }
    }

    window.GRABBER = GRABBER // Make it accessible for debugging/manual triggering

    // Start camera stream
    const params = {
        audio: false, // Audio is off as per your code
        video: {
            width: { ideal: width },
            height: {  ideal: height },
            // You might want to add frameRate constraint here if needed
            // frameRate: { ideal: 30 }
        }
    };

     // Request media devices
    navigator.mediaDevices.getUserMedia(params)
    .then( stream => {
         console.log("Camera stream received.");
        vidcap.srcObject = stream;
        vidcap.onloadedmetadata = function(e) {
             console.log("Video element loaded metadata.");
             // Ensure video dimensions are set on canvas if needed
             framegrabber.width = vidcap.videoWidth;
             framegrabber.height = vidcap.videoHeight;
             if (preview) {
                  vidcap.width = vidcap.videoWidth; // Adjust preview size? Maybe not needed if CSS handles it
                  vidcap.height = vidcap.videoHeight;
             }
             // Start the frame grabbing loop after video metadata is loaded
            GRABBER();
            console.log("Video stream ready and GRABBER started.");
            MM.camera.started = 1; // Mark as started successfully
            done = 1; // Signal the generator to finish waiting
        }
         // Listen for video errors
        vidcap.addEventListener('error', (e) => {
             console.error("Video element error:", e);
             onCameraFail(new Error(`Video element error. Code: ${vidcap.error?.code}`));
        });
    })
    .catch(e => {
         console.error("navigator.mediaDevices.getUserMedia failed:", e);
         onCameraFail(e); // Use your existing error handler
    });

     // Wait for the camera stream to be ready or fail
    while (!done) {
        yield 0; // Yield control while waiting
    }

    // The success/failure state is now reflected in MM.camera.started (1 or -1)
    // If successful, GRABBER is already writing to FS.
    // The Python side using get_raw() will wait for the first frame file to appear.

    // Yield the final camera start status (1 for success, -1 for failure)
    yield window.MM.camera.started;

     if (MM.camera.started === 1) {
          console.log("Camera initialization yielding success state.");
          // The generator can continue if the Python side calls get_raw()
     } else {
          console.error("Camera initialization yielding failure state.");
          // The generator will stop here if it was called via `yield * MM.camera.init(...)`
     }
}

//=========================================================
// js.SVG

window.svg = { }

window.svg.init = function () {
     // Use OffscreenCanvas if supported, otherwise a hidden HTMLCanvasElement
    if (svg.screen)
        return // Already initialized

     try {
         svg.screen = new OffscreenCanvas(canvas.width, canvas.height); // canvas needs to be defined globally or passed
         console.log("Using OffscreenCanvas for SVG rendering.");
     } catch (e) {
         console.warn("OffscreenCanvas not supported or failed for SVG, falling back to hidden HTMLCanvasElement:", e);
         svg.screen = document.createElement('canvas');
         svg.screen.width = canvas ? canvas.width : 640; // Default size if canvas is not defined yet
         svg.screen.height = canvas ? canvas.height : 480;
         svg.screen.style.display = 'none'; // Keep it hidden
         document.body.appendChild(svg.screen); // Add to body even if hidden
     }

     // Check if canvas is defined for context size
     if (window.canvas) {
         svg.screen.width = canvas.width;
         svg.screen.height = canvas.height;
     } else {
         console.warn("SVG init: 'canvas' element not found. Using default size.");
     }


    svg.ctx = svg.screen.getContext('2d');
     if (!svg.ctx) {
         console.error("Failed to get 2D context for SVG rendering canvas.");
         // Maybe mark svg functionality as broken?
     }
}

window.svg.render =  async function * (path, dest) {
     if (!svg.ctx) {
          console.error("SVG rendering context not initialized. Call svg.init first or ensure canvas exists.");
          yield new Error("SVG context not available"); // Yield error
          return; // Exit generator
     }

    var converted = 0;
    // svg.init() // Call init inside render just in case, but ideally done earlier
     window.svg.init(); // Ensure context exists

    dest = dest || path + ".png";
    let blob = null;
    let url = null;

    try {
        const svgData = FS.readFile(path, { encoding: 'utf8' }); // Read as text for SVG
        blob = new Blob([svgData], {type: 'image/svg+xml'});
        url = URL.createObjectURL(blob);
    } catch (e) {
        console.error(`Failed to read SVG file from FS at ${path}:`, e);
        yield new Error(`Failed to read SVG file: ${e.message}`);
        return;
    }


    svg.ctx.clearRect(0, 0, svg.screen.width, svg.screen.height); // Clear the canvas

    let rd = new Image();
        rd.src = url;

    // Use a Promise to wait for the image to load and processing to finish
    const renderPromise = new Promise((resolve, reject) => {
        rd.onload = async function () {
             try {
                // Draw the loaded SVG image onto the canvas
                svg.ctx.drawImage(rd, 0, 0, svg.screen.width, svg.screen.height); // Draw stretched to canvas size

                // Convert the canvas content to a PNG Blob
                window.svg.blob = await svg.screen.convertToBlob({type:"image/png"});

                // Use FileReader to read the Blob data
                const reader = new FileReader();
                reader.onloadend = () => { // Use loadend for success or failure
                     if (reader.error) {
                         console.error("FileReader error reading PNG blob:", reader.error);
                         reject(reader.error); // Reject the promise on reader error
                         return;
                     }
                     try {
                         // Write the PNG data to the virtual FS
                        FS.writeFile(dest, new Int8Array(reader.result) );
                        console.log("SVG conversion of", path,"to png complete :", dest);
                        resolve(dest); // Resolve the promise with the destination path
                     } catch (fsWriteError) {
                         console.error(`Error writing PNG file to FS at ${dest}:`, fsWriteError);
                         reject(fsWriteError); // Reject on FS write error
                     }
                };
                reader.readAsArrayBuffer(window.svg.blob); // Start reading the blob

             } catch (drawOrBlobError) {
                 console.error("Error during SVG drawing or blob conversion:", drawOrBlobError);
                 reject(drawOrBlobError); // Reject the promise on draw/blob error
             } finally {
                URL.revokeObjectURL(url); // Clean up the Blob URL immediately after Image is loaded
                // The Blob data is now in reader.result (handled by reader.onloadend)
                // No need to keep the blob URL alive.
             }
        };

        rd.onerror = function (e) {
            console.error(`Error loading SVG image from URL ${url}:`, e);
            URL.revokeObjectURL(url); // Clean up on error too
            reject(new Error(`Failed to load SVG image: ${e.message}`)); // Reject the promise on image load error
        };
    });

    // The generator yields while waiting for the promise to resolve or reject
    let result = null;
    try {
        result = await renderPromise;
        converted = 1; // Mark success if promise resolved
    } catch (e) {
         console.error("SVG render promise failed:", e);
         result = e; // Capture the error
         converted = -1; // Mark failure
    }


    // Yield the result (destination path on success, or Error object on failure)
    yield result;

    // The generator is done.
}

window.svg.draw = function (path, x, y) {
     if (!svg.ctx) {
          console.error("SVG drawing context not initialized. Call svg.init first or ensure canvas exists.");
          return; // Exit if context is not available
     }
     // Ensure the main canvas element is available globally
     const mainCanvas = window.canvas || document.getElementById('canvas');
     const mainCtx = mainCanvas ? mainCanvas.getContext('2d') : null;

     if (!mainCtx) {
         console.error("Main canvas or its 2D context not available for SVG drawing.");
         return;
     }


    // svg.init() // Ensure svg canvas is initialized, although it's mainly for render
    // For drawing directly to main canvas, we only need to load the image.


    let blob = null;
    let url = null;

    try {
        const svgData = FS.readFile(path, { encoding: 'utf8' }); // Read as text
        blob = new Blob([svgData], {type: 'image/svg+xml'});
        url = URL.createObjectURL(blob);
    } catch (e) {
        console.error(`Failed to read SVG file from FS at ${path} for drawing:`, e);
        return;
    }


    const rd = new Image();
    rd.src = url
    function load_cleanup () {
         // Draw the loaded SVG image onto the main canvas
         // You might want to scale it here if needed, currently draws at intrinsic SVG size
        mainCtx.drawImage(rd, x || 0, y || 0 );
        URL.revokeObjectURL(url); // Clean up the Blob URL
         console.log(`SVG from ${path} drawn to main canvas at (${x||0}, ${y||0}).`);
    }
    rd.addEventListener('load', load_cleanup );
     rd.addEventListener('error', (e) => {
         console.error(`Error loading SVG image from URL ${url} for drawing:`, e);
         URL.revokeObjectURL(url); // Clean up on error too
     });
}

//=========================================================
// js.misc

window.chromakey = function(context, r,g,b, tolerance, alpha) {
     // Ensure a context is provided or try to get the main canvas context
     const targetCtx = context || (window.canvas ? window.canvas.getContext('2d', { willReadFrequently: true }) : null);

     if (!targetCtx) {
         console.error("Cannot perform chromakey: No 2D context provided or main canvas context not available.");
         return;
     }


    var imageData = targetCtx.getImageData(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
    var data = imageData.data;

    // Default to the color of the first pixel if r,g,b are not provided
     if (r === undefined || r === null) r = data[0];
     if (g === undefined || g === null) g = data[1];
     if (b === undefined || b === null) b = data[2];

    tolerance = tolerance || 0; // Default tolerance to 0, 255 makes little sense as a threshold
    alpha = alpha || 0; // Default alpha to 0 (fully transparent)

    for(var i = 0, n = data.length; i < n; i += 4) {
        // Calculate color difference (Manhattan distance in RGB space)
        var diff = Math.abs(data[i] - r) + Math.abs(data[i+1] - g) + Math.abs(data[i+2] - b);

        // Check if the difference is within the tolerance
        // Note: Your original code's tolerance check `diff <= tolerance` with `tolerance -= 255` seems reversed.
        // A common chromakey checks if `diff <= threshold`. Let's assume tolerance is the threshold.
        if(diff <= tolerance) {
            data[i + 3] = alpha; // Set alpha channel
        }
    }
    targetCtx.putImageData(imageData, 0, 0);
    console.log(`Chromakey applied with target RGB(${r},${g},${b}), tolerance ${tolerance}, alpha ${alpha}.`);
}



window.mobile_check = function() {
    // Basic regex check for common mobile user agents
    let check = false;
    (   function(a){
        if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))
            check = true;
        }
    )(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

window.mobile_tablet = function() {
    // Regex check including tablets
    let check = false;
    (   function(a){
        if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))
            check = true;
        }
    )(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

window.mobile = () => {
    try {
        // Use the newer userAgentData if available
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
             return navigator.userAgentData.mobile;
        }
    } catch (x) {
        console.warn("Error accessing navigator.userAgentData.mobile:", x);
    }

    // Fallback to older checks if userAgentData is not available or fails
    return mobile_check(); // Use the basic regex check
}


if (navigator.connection) {
    // Check if connection type and downlinkMax are available
    if ( navigator.connection.type === 'cellular' ) {
        console.warn("Connection:","Cellular");
        if ( navigator.connection.downlinkMax !== Infinity && navigator.connection.downlinkMax <= 0.115) { // Check for Infinity before comparing
            console.warn("Connection:","Likely 2G"); // Use "Likely" as this is an estimate
        } else if (navigator.connection.effectiveType) { // Check effectiveType if available
             console.warn("Connection: Effective Type:", navigator.connection.effectiveType);
        }
    } else {
        console.warn("Connection:","Non-cellular (e.g., Wi-Fi, Wired)");
    }
     if (navigator.connection.saveData) {
          console.warn("Connection: Save Data mode is enabled.");
     }
}


// js.FTDI

window.io = {}

async function open_port() {
    // Check for WebUSB API support
    if (!navigator.usb) {
         console.error("WebUSB API not supported in this browser.");
         window.io.port = null; // Explicitly set to null on failure
         return null; // Return null promise
    }
    var device = null; // WebUSBDevice instance from requestDevice

     try {
        // device = new WebUSBSerialDevice(); // This class might not be built-in, depends on external script
        // Assuming WebUSBSerialDevice is something that provides getAvailablePorts and requestNewPort
        // A more standard WebUSB flow involves navigator.usb.requestDevice

        // Standard WebUSB flow:
        // Request a device based on filters (e.g., vendorId, productId)
         console.log("Requesting USB device...");
         const devices = await navigator.usb.requestDevice({ filters: [{ /* add appropriate filters, e.g. vendorId */ }] });
         if (!devices) {
             console.warn("No USB device selected or found.");
             window.io.port = null;
             return null;
         }
         // Assuming the selected device is the one we want to use as a serial port
         device = devices; // The result of requestDevice is the device object directly

         console.log("USB device selected:", device);

        // Find a configuration and interface with a CDC ACM endpoint (serial port)
        // This part is complex and depends on the specific device's descriptors.
        // Libraries like https://github.com/serialport/webserialport-wrapper might simplify this.
        // Or you need to manually iterate through configurations, interfaces, and endpoints.
        // For a simple answer, let's assume a 'port' object representing the serial connection is obtained.
        // This 'port' object would need methods like connect, send, close, and emit data events.

        // *** Placeholder for actual USB serial connection logic ***
        // Replace this placeholder with actual code to open endpoints and set up reading/writing.
        // This requires detailed knowledge of the target USB device's descriptors (vid, pid, endpoints, interfaces).
        // The original code seems to imply a 'WebUSBSerialDevice' helper class which is not standard JS.
        // If you have a separate 'webusb-serial-device.js' file, that needs to be included too.

        // For demonstration, let's simulate a basic 'port' object structure if the device was found:
         const port = {
             device: device, // Store the found device
             isConnected: false,
             data: "", // Buffer for incoming data
             reader: null, // ReadableStreamDefaultReader
             writer: null, // WritableStreamDefaultWriter
             readLoop: async function(callback, errorCallback) {
                  if (!this.reader) {
                      errorCallback(new Error("Serial reader not initialized."));
                      return;
                  }
                  console.log("Serial read loop started.");
                  try {
                      while (this.isConnected) {
                          const { value, done } = await this.reader.read();
                          if (done) {
                              console.log("Serial reader finished.");
                              break;
                          }
                          if (value) {
                              // Assuming data is text, decode it
                              const text = new TextDecoder().decode(value);
                              callback(text); // Call the user-provided callback with data
                          }
                      }
                  } catch (error) {
                      console.error("Serial read loop error:", error);
                      if (errorCallback) errorCallback(error);
                  } finally {
                      console.log("Serial read loop exiting.");
                       this.close().catch(e => console.error("Error closing port after read loop:", e));
                  }
             },
             connect: async function(dataCallback, errorCallback) {
                 try {
                     // *** Replace with actual USB device open, claim interface, open endpoints ***
                     // Example:
                     // await this.device.open();
                     // const configuration = this.device.configuration || this.device.configurations[0];
                     // await this.device.selectConfiguration(configuration.configurationValue);
                     // const interface = configuration.interfaces.find(i => /* find correct interface */);
                     // await this.device.claimInterface(interface.interfaceNumber);
                     // const endpointIn = interface.endpoints.find(e => e.direction === 'in');
                     // const endpointOut = interface.endpoints.find(e => e.direction === 'out');
                     // this.reader = this.device.transferIn(endpointIn.endpointNumber, 64).getReader(); // Example read
                     // this.writer = this.device.transferOut(endpointOut.endpointNumber).getWriter(); // Example write

                     // Dummy connect for now
                     console.log("Dummy USB port connected.");
                     this.isConnected = true;
                     this.reader = { // Dummy reader
                         read: async () => { await delay(1000); console.log("Dummy read..."); return { value: new TextEncoder().encode("dummy data\r\n"), done: false }; },
                         releaseLock: () => console.log("Dummy reader releaseLock")
                     };
                     this.writer = { // Dummy writer
                         write: async (data) => { console.log("Dummy write:", new TextDecoder().decode(data)); return; },
                         close: async () => console.log("Dummy writer close"),
                         releaseLock: () => console.log("Dummy writer releaseLock")
                     };

                     // Start the read loop
                     this.readLoop(dataCallback, errorCallback);

                     return "connected"; // Indicate success
                 } catch (error) {
                     console.error("Failed to connect to USB device:", error);
                     this.isConnected = false;
                     if (errorCallback) errorCallback(error);
                     // Clean up readers/writers/interfaces/device if they were partially opened
                     // ... cleanup logic ...
                     return null; // Indicate failure
                 }
             },
             send: async function(data) {
                 if (!this.isConnected || !this.writer) {
                     console.error("Cannot send data: Port not connected or writer not available.");
                     return;
                 }
                 try {
                     await this.writer.write(data);
                 } catch (error) {
                     console.error("Error sending data:", error);
                     // Handle write error, maybe disconnect
                 }
             },
             close: async function() {
                 if (!this.isConnected) {
                     console.log("Port already closed.");
                     return;
                 }
                 console.log("Closing USB port.");
                 this.isConnected = false;
                 try {
                     // Release reader and writer locks
                     if (this.reader) await this.reader.cancel().catch(e => console.warn("Error cancelling reader:", e));
                     if (this.reader && this.reader.releaseLock) this.reader.releaseLock(); // Some implementations need this
                     if (this.writer) await this.writer.close().catch(e => console.warn("Error closing writer:", e));
                     if (this.writer && this.writer.releaseLock) this.writer.releaseLock(); // Some implementations need this

                     // Release interfaces and close the device
                     // await this.device.releaseInterface(...); // Release claimed interface(s)
                     // await this.device.close(); // Close the device

                 } catch (error) {
                     console.error("Error during USB port close:", error);
                 } finally {
                      this.reader = null;
                      this.writer = null;
                      // device = null; // Don't clear device object if it might be reused
                      console.log("USB port closed.");
                 }
             },
             // Add a disconnect event listener if the underlying implementation supports it
             // device.addEventListener('disconnect', (event) => { ... });
         };

         // *** End of Placeholder ***

         // The original code's 'port.data = port.data + data' suggests 'port' itself holds the buffer
         // Let's ensure the port object has this buffer property
         port.data = "";


        const codec = new TextDecoder(); // Used inside the dummy readLoop for decoding

        // The cb function in the original code expects to receive decoded text directly
        // Modify the dummy readLoop to pass decoded text to the callback.

        function cb(dataChunk) { // This cb receives decoded text from the readLoop
            console.log("recv", dataChunk);
            // Append text data to the port's buffer
            if (window.io.port) {
                window.io.port.data += dataChunk;
            }
        }

        port.read = () => {
            const data = window.io.port ? window.io.port.data : "";
            if (window.io.port) {
                window.io.port.data = ""; // Clear the buffer after reading
            }
            return data;
        }

        port.write = (data) => {
            // Ensure data is encoded to bytes before sending via USB
             if (window.io.port && window.io.port.send) {
                 const coder = new TextEncoder();
                 window.io.port.send(coder.encode(data));
             } else {
                 console.error("Cannot write: Port not available or send method missing.");
             }
        }

         // Connect the port and start the read loop
         const connection_status = await port.connect(cb, (error)=>console.error("USB Port Error:", error) );

         if (connection_status === "connected") {
            window.io.port = port;
            console.log("USB port opened successfully.");
         } else {
             console.error("Failed to open USB port.");
             window.io.port = null;
         }

    } catch (requestError) {
        console.error("Error requesting USB device:", requestError);
        window.io.port = null; // Ensure port is null on failure
    }


     // Yield until window.io.port is set (either to a valid port or null)
    while (window.io.port === undefined) // Wait for the try/catch block to complete and set window.io.port
        yield 0;

     // Yield the port object (will be null on failure, the port object on success)
    yield window.io.port;
}

window.io.open_serial = function * () {
    // This generator function now correctly calls the async open_port and yields its result
    yield* open_port();
}


//TODO: battery
    // https://developer.mozilla.org/en-US/docs/Web/API/BatteryManager/levelchange_event

//TODO: camera+audio cap
    //https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

// https://developer.mozilla.org/en-US/docs/Web/API/Accelerometer

// https://developer.mozilla.org/en-US/docs/Web/API/AmbientLightSensor



window.debug = function () {
    vm.config.debug = true
    const debug_hidden =  false
    try {
        // Check if custom_onload is a function before calling
        if (typeof window.custom_onload === 'function') {
             window.custom_onload(debug_hidden);
        } else {
             console.warn("window.custom_onload is not defined or not a function.");
             throw new Error("custom_onload not available"); // Trigger catch block
        }

    } catch (x) {
        console.error("Using debug UI default, because no custom_onload or failure:", x);
        // Ensure elements exist before trying to access/modify 'hidden'
        const elements = ["pyconsole", "system", "iframe", "transfer", "info", "box", "terminal", "stdio", "stdout", "canvas", "canvas3d", "vidcap", "framegrabber_canvas", "dlg_multifile"]; // Add relevant IDs
        for (const id of elements ) {
             const element = document.getElementById(id);
             if (element) {
                 element.hidden = debug_hidden;
             } else {
                 // console.warn(`Debug element #${id} not found.`);
             }
        }
    }
    // Ensure python object and PyRun_SimpleString method exist before calling
    if (window.python && typeof window.python.PyRun_SimpleString === 'function') {
        vm.PyRun_SimpleString(`#!
shell.uptime()
`);
    } else {
        console.warn("Python runtime not ready for shell.uptime()");
    }

     // Ensure window_resize is defined before calling
    if (typeof window.window_resize === 'function') {
         window_resize();
    } else {
         console.warn("window_resize function is not defined.");
    }
}


window.blob = function blob(filename) {
    console.warn(__FILE__, "1458: TODO: revoke blob url (Blob URLs can be garbage collected, but explicit revoke is safer)");
     try {
        // Ensure FS and FS.readFile exist
        if (window.FS && typeof FS.readFile === 'function') {
             const fileData = FS.readFile(filename);
             const blob = new Blob([fileData]);
             const url = URL.createObjectURL(blob);
             // Consider adding this URL to a list to revoke later if memory is a concern
             return url;
        } else {
            console.error("FS or FS.readFile not available to create blob.");
            return null;
        }
     } catch (e) {
         console.error(`Error creating blob for file ${filename}:`, e);
         return null;
     }
}

// ========================================
// js.RPC


window.rpc = { path : [], call : "", argv : [] }

function bridge(host) {
     // Check if host object is valid
     if (!host) {
          console.error("RPC bridge created with invalid host.");
          // Return a dummy object that logs errors or null
          return {}; // Or throw error
     }

    const pybr = new Proxy(function () {}, {
    get(_, k, receiver) {
         if (typeof k === 'symbol') { // Handle Symbol properties (like Symbol.toStringTag)
             // Return something reasonable for known symbols or just the proxy itself
             if (k.toString() === 'Symbol(Symbol.toStringTag)') {
                  return 'Function'; // Or 'Proxy'
             }
              // For other symbols, maybe just return the proxy to allow chaining? Or throw error?
             return pybr; // Allowing chaining for unknown symbols too
         }
        rpc.path.push(String(k)); // Convert key to string
        return pybr;
    },
    apply(_, thisArg, argv) { // Use thisArg standard parameter name
        const call = rpc.path.join(".");
        // Check if the host is ready to receive RPC calls
         if (host === window.python && window.python && typeof window.python.PyRun_SimpleString === 'function' && window.python.is_ready) {
             // Check if argv is an array
             if (!Array.isArray(argv)) {
                  console.error("RPC argv is not an array:", argv);
                  argv = []; // Default to empty array
             }

// TODO: rpc id / event serialisation - The original code queues a generic 'rpc' event, not tied to response.
            // The event should likely be the *first* argument passed from Python.
            // If this bridge is called from JS (e.g., a DOM event handler), 'window.event' might be available.
            // If called from Python via something like `__EMSCRIPTEN__.rpc_js_call(...)`, the first arg should be the event data.

            // Let's assume the first argument from Python will contain event data or an RPC ID.
            // When calling from JS, the first arg *should* be the JS event object or relevant data.

            // For now, mirroring the original logic: queue the event with call, argv, and window.event (if available)
            // This assumes the Python side's EventTarget can handle this structure.
             const eventData = {
                 "call": call,
                 "argv": argv,
                 "rpcid": window.event ? "js_event:" + window.event.type : "js_call" // Use a simple marker if no DOM event
             };
             // If Python is the host, queue the event
             queue_event("rpc", eventData); // queue_event now checks if python/vt is ready

        } else if (host && typeof host.click === 'function') { // Handle the non-python host case (like a hidden button)
             // This pattern suggests using a DOM element (like a button) to signal Python in a worker.
             // The `host.click()` would trigger an event listener *on that DOM element* which then messages the worker.
             // The rpc data needs to be stored somewhere accessible to the event listener.
             // window.rpc object is used for this.

             // Check if argv is an array
             if (!Array.isArray(argv)) {
                  console.error("RPC argv is not an array:", argv);
                  argv = []; // Default to empty array
             }

            window.rpc.call = call;
            window.rpc.argv = Array.from(argv); // Store args in window.rpc

            // The original code assumes the first arg *should* be window.event.
            // This is fragile. A better approach is for the JS caller to explicitly pass event data.
            // Keeping original logic for now but warning.
            if (window.rpc.argv.length === 0 && window.event) {
                 console.warn("RPC call made with no arguments, prepending window.event.");
                 window.rpc.argv.unshift(window.event);
            } else if (window.rpc.argv.length > 0 && window.event && window.rpc.argv[0] !== window.event) {
                 // This check is problematic. The first argument might legitimately not be window.event.
                 // Removing this check as it's likely incorrect usage pattern assumption.
                 // console.error("event should always be first param?", window.event, window.rpc.argv[0]);
                 // window.rpc.argv.unshift(window.event); // Still prepending as per original logic? No, this is weird.
                 // Let's just log the warning and keep the args as they were passed.
                 console.warn("RPC call has arguments, but first is not window.event.", {passed_args: argv, current_event: window.event});
            }

            // Trigger the click event on the host element
            host.click();

        } else {
             console.error("RPC host is not a valid python runtime or clickable element:", host);
        }

        rpc.path.length = 0; // Clear the path for the next call
        // Note: The Proxy apply method typically returns void or a Promise if the underlying call is async.
        // The original code returns nothing explicitly, which is fine for synchronous proxies,
        // but might be limiting if RPC needs to return values.
        // For now, matching original behavior.
    }
  });
  return pybr
}


// ========================================
// js.FETCH


window.Fetch = {}

// generator functions for async fetch API
// script is meant to be run at runtime in an emscripten environment

// Fetch API allows data to be posted along with a POST request
window.Fetch.POST = function * POST (url, data, flags)
{
    // post info about the request
    console.log("POST: " + url + "\nData: ", data); // Log data object, not stringified yet
    var request = null;
    try {
        request = new Request(url, {
            method: 'POST',
             headers: {
                 'Content-Type': 'application/json' // Often needed for JSON bodies
             },
            body: JSON.stringify(data) // Stringify the data object
        });
    } catch (e) {
         console.error("Error creating POST request:", e);
         // Yield an error? Or just return? Generator should probably yield error.
         yield new Error(`Failed to create POST request: ${e.message}`);
         return; // Exit generator
    }


    var content = 'undefined'; // Use a unique marker string or null
     let fetchError = null;

    fetch(request, flags || {})
   .then(resp => {
         if (!resp.ok) {
             const error = new Error(`HTTP error! status: ${resp.status}`);
             error.response = resp; // Attach the response object to the error
             throw error; // Throw to enter the catch block
         }
         return resp.text(); // Assuming text response for now
    })
   .then((resp_text) => {
        console.log("POST response:", resp_text);
        content = resp_text; // Set the content on success
   })
   .catch(err => {
         // handle errors
         console.error("An Error Occurred during POST fetch:");
         console.error(err);
         fetchError = err; // Store the error
         content = null; // Set content to null or an error marker on failure
    });

    // Generator loop to wait for the async fetch to complete
    while(content === 'undefined' && fetchError === null){ // Wait while still pending
        yield undefined; // Yield undefined or null while waiting
    }

     // Yield the result or the error
     if (fetchError) {
          yield fetchError; // Yield the error object
     } else {
          yield content; // Yield the fetched content (text)
     }
     // Generator is done
}

// Only URL to be passed
// when called from python code, use urllib.parse.urlencode to get the query string
window.Fetch.GET = function * GET (url, flags)
{
    console.log("GET: " + url);
    var request = null;
     try {
         request = new Request(url, { method: 'GET' });
     } catch (e) {
          console.error("Error creating GET request:", e);
          yield new Error(`Failed to create GET request: ${e.message}`);
          return;
     }

    var content = 'undefined'; // Use a unique marker string or null
     let fetchError = null;

    fetch(request, flags || {})
   .then(resp => {
         if (!resp.ok) {
             const error = new Error(`HTTP error! status: ${resp.status}`);
             error.response = resp;
             throw error;
         }
         return resp.text(); // Assuming text response
    })
   .then((resp_text) => {
        console.log("GET response:", resp_text);
        content = resp_text; // Set content on success
   })
   .catch(err => {
         // handle errors
         console.error("An Error Occurred during GET fetch:");
         console.error(err);
         fetchError = err; // Store the error
         content = null; // Set content to null or an error marker on failure
    });

    // Generator loop to wait
    while(content === 'undefined' && fetchError === null){ // Wait while pending
        // generator
        yield undefined; // Yield undefined or null while waiting
    }

    // Yield the result or the error
     if (fetchError) {
          yield fetchError; // Yield the error object
     } else {
          yield content; // Yield the fetched content (text)
     }
    // Generator is done
}



// ====================================================================================
//          pyodide compat layer
// ====================================================================================

// This section seems specific to providing a Pyodide-like interface.
// Your main script doesn't seem to use loadPyodide. Keeping it for completeness.
// Note: This assumes a specific interaction pattern with the underlying VM.
// The original runPython implementation was a placeholder.

window.loadPyodide =
    async function loadPyodide(cfg) {
        // Ensure cfg is an object
        cfg = cfg || {};

        // Provide a runPython stub. The actual execution depends on how the VM works.
        // The original code uses vm.PyRun_SimpleString for string execution.
        // Pyodide's runPython is more sophisticated (evaluates expressions, returns values).
        // This implementation is a basic placeholder matching the original.
        vm.runPython =
            function runPython(code) {
                console.warn("loadPyodide.runPython called. Note: This might not return results like Pyodide's runPython.");
                console.log("Executing Python string via PyRun_SimpleString:", code);
                // Check if vm.PyRun_SimpleString is available
                if (vm && typeof vm.PyRun_SimpleString === 'function') {
                    vm.PyRun_SimpleString(code);
                    return 'Execution triggered (result not captured)'; // Indicate execution was attempted
                } else {
                    console.error("vm.PyRun_SimpleString is not available.");
                    return 'Error: Runtime not ready for direct execution';
                }
            }

        console.warn("loadPyodide stub called. Initializing Pygbag/Emscripten VM.");
        // Call the standard auto_start and onload sequence
        // auto_start needs a cfg object, potentially derived from the loadPyodide cfg
        // The original auto_start also looks for script tags. Need to decide which path loadPyodide takes.
        // Assuming loadPyodide provides the main script content or config.
        // Let's adapt auto_start to accept an optional config object.

        // Adapt cfg for auto_conf if needed. loadPyodide cfg might be different from script tag cfg.
        const vmConfigFromPyodideCfg = {
            // Map Pyodide cfg properties to vm.config properties if necessary
            // For now, assume the primary configuration still comes from script tags or defaults.
            // If loadPyodide *must* provide the main script/module, that needs more logic here.
            // The original loadPyodide just calls auto_start with the passed cfg.
            // This seems incorrect if auto_start expects script tag info.

            // Let's assume loadPyodide is *replacing* the script tag method.
            // We need to construct a cfg object for auto_conf.
            url: cfg.indexURL || './pythons.js', // Default URL if none provided
            python: cfg.python || 'cpython3', // Default python version
            os: cfg.stdout ? 'stdout' : 'gui', // Simple OS based on stdout flag
            text: cfg.code || '', // If code is provided directly
            module: cfg.module || '', // If module name is provided
            id: '__pyodide_loaded__',
            // Pass other relevant cfg properties or map them
            columns: cfg.columns,
            lines: cfg.lines,
            console: cfg.console,
            cdn: cfg.cdnURL // Pyodide uses indexURL, this might map to cdn
        };

        // Call auto_conf with the constructed config
        auto_conf(vmConfigFromPyodideCfg);

        // If 'code' or 'module' is provided in cfg, set the main script block
        if (vmConfigFromPyodideCfg.text) {
             vm.script.blocks = [vmConfigFromPyodideCfg.text];
             vm.PyConfig.run_filename = '__pyodide_code__.py'; // Indicate running inline code
        } else if (vmConfigFromPyodideCfg.module) {
             // This needs logic to fetch the module code... more complex.
             console.error("loadPyodide with 'module' is not fully implemented in this stub.");
             vm.script.blocks = [];
             vm.PyConfig.run_module = vmConfigFromPyodideCfg.module; // Signal to run as module? Depends on VM capability.
        } else {
            // Fallback if no code or module provided? Maybe just run rc.py?
            vm.script.blocks = ["print('No Python code provided to loadPyodide.')"];
             vm.PyConfig.run_filename = '__startup__.py';
        }


        // Initialize the VM
        await onload(); // Call the main initialization function

        // Wait for the Python runtime to be ready
        await _until(defined)("python");

        // Pyodide typically allows redirecting stdout/stderr.
        // If cfg.stdout is a function, redirect vm's output.
        if (cfg.stdout && typeof cfg.stdout === 'function' && vm && vm.vt && vm.vt.xterm) {
            console.warn("loadPyodide: Redirecting stdout to provided function.");
            vm.vt.xterm.write = cfg.stdout; // Replace the write method
        } else {
            console.warn("loadPyodide: No stdout function provided or terminal not ready.");
        }


        console.warn("loadPyodide: Python runtime should now be available globally as 'python'.");
        return vm; // Return the VM object (acting as the pyodide object)
    }

// ====================================================================================
//          STARTUP
//====================================================================================

async function onload() {
    console.warn("onload Begin");

    var debug_hidden = true;

    // this is how emscripten "os layer" will find it
    window.Module = vm; // Ensure vm is assigned to Module

    var debug_mobile_request;
    try {
        // Check window.top availability and location.hash safely
        if (window.top && window.top.location && window.top.location.hash) {
             debug_mobile_request = (window.top.location.hash.search("#debug-mobile") >= 0);
        } else {
             debug_mobile_request = (window.location.hash.search("#debug-mobile") >= 0); // Fallback to self location
        }
    } catch (x) {
        console.warn("FIXME: Error accessing window.top.location.hash:", x);
        debug_mobile_request = (window.location.hash.search("#debug-mobile") >= 0); // Fallback
    }

    const nuadm = mobile() || debug_mobile_request;

    var debug_user;
    try {
         if (window.top && window.top.location && window.top.location.hash) {
             debug_user = window.top.location.hash.search("#debug") >= 0;
         } else {
             debug_user = window.location.hash.search("#debug") >= 0; // Fallback
         }
    } catch (x) {
        console.warn("FIXME: Error accessing window.top.location.hash:", x);
        debug_user = window.location.hash.search("#debug") >= 0; // Fallback
    }


    // Ensure vm.PyConfig and vm.PyConfig.orig_argv exist before accessing
    const debug_dev = (vm.PyConfig && Array.isArray(vm.PyConfig.orig_argv) && (vm.PyConfig.orig_argv.includes("-X dev") || vm.PyConfig.orig_argv.includes("-i"))) || false;

    const debug_mobile = nuadm && ( debug_user || debug_dev );

    // Check if vm.config exists before setting properties
    vm.config = vm.config || {}; // Ensure config object exists

    if ( debug_user || debug_dev || debug_mobile ) {
        debug_hidden = false;
        vm.config.debug = true;
        if ( is_iframe() ){
            vm.config.gui_divider = vm.config.gui_divider || 3; // Set default if not already set
        } else {
            vm.config.gui_divider = vm.config.gui_divider || 2; // Set default if not already set
        }
    }
    console.warn(`


== FLAGS : is_mobile(${nuadm}) dev=${debug_dev} debug_user=${debug_user} debug_mobile=${debug_mobile} ==


`); // Added line break for readability
    if ( is_iframe() ) {
        console.warn("======= IFRAME =========");
    }

    feat_lifecycle();

    // container for html output
    var html = document.getElementById('html');
    if (!html){
        html = document.createElement('div');
        html.id = "html";
         // Consider adding some basic styling
         // html.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000; overflow: hidden;';
        document.body.appendChild(html);
    }

    var has_vt = false; // Flag to track if *any* terminal feature was successfully set up

    // Ensure vm.config.features is an array before iterating
    vm.config.features = vm.config.features || [];


    // Process features serially using async/await
    for (const feature of vm.config.features) {
        console.log(`Processing feature: ${feature}`); // Log which feature is being processed

        if (feature.startsWith("3d")) {
            vm.config.user_canvas_managed = 3;
        }

        if (feature.startsWith("embed")) {
            vm.config.user_canvas_managed = vm.config.user_canvas_managed || 1;
            const canvasXd = feat_gui(true); // feat_gui needs a canvas, pass true for hidden if embed
             // Check if canvasXd is valid before accessing innerHTML/dataset
             if (canvasXd) {
                if ( canvasXd.innerHTML && canvasXd.innerHTML.length > 20 ) {
                    vm.PyConfig.frozen = "/tmp/to_embed.py";
                }
                if (canvasXd.dataset) {
                    if ( canvasXd.dataset.path ) { // Use dataset.path first if available
                        vm.PyConfig.frozen_path = canvasXd.dataset.path;
                    } else if (canvasXd.dataset.src) { // Fallback to dataset.src
                        vm.PyConfig.frozen_path = canvasXd.dataset.src;
                    } else { // Default path if neither is specified
                        // This default might be problematic, maybe use the HTML doc path?
                         vm.PyConfig.frozen_path = location.href.rsplit("/",1)[0]; // Use base URL of current doc
                    }
                     if (canvasXd.dataset.embed) {
                         vm.PyConfig.frozen_handler = canvasXd.dataset.embed;
                     }
                }
                 // Check if vm.PyConfig.frozen is set before writing
                 if (vm.PyConfig && vm.PyConfig.frozen && FS && typeof FS.writeFile === 'function') {
                     try {
                         FS.writeFile(vm.PyConfig.frozen, canvasXd.innerHTML || ""); // Write canvas content as frozen code
                         console.log(`Embedded content written to ${vm.PyConfig.frozen}`);
                     } catch (fsError) {
                         console.error(`Error writing embedded content to FS: ${fsError}`);
                         vm.PyConfig.frozen = undefined; // Unset frozen if write fails
                     }
                 } else if (vm.PyConfig && vm.PyConfig.frozen) {
                      console.warn(`Skipping writing embedded content: FS not ready or frozen path not set correctly (${vm.PyConfig.frozen}).`);
                      vm.PyConfig.frozen = undefined; // Unset frozen if write fails
                 } else {
                      console.log("No embedded content to write."); // No frozen path or content
                 }

             } else {
                 console.error("feat_gui failed to return a valid canvas for 'embed' feature.");
             }

            // only canvas when embedding 2D/3D, stdxxx go to console (or default stdout).
            // If 'embed' is processed, should other terminal features be skipped?
            // Assuming 'embed' is primary and other terminals are secondary.
            // Let's remove other terminal features from the list after embed is processed.
            const terminalFeatures = ['vt', 'vtx', 'stdout'];
             vm.config.features = vm.config.features.filter(f => !terminalFeatures.includes(f));
             console.log("Processed 'embed', remaining features:", vm.config.features);

            break // Stop processing other features if 'embed' is handled as primary
        }

        if (feature.startsWith("snd")) {
            feat_snd(debug_hidden); // Assuming feat_snd is synchronous or handles its own async
        }

        if (feature.startsWith("gui")) {
            feat_gui(debug_hidden); // Assuming feat_gui is synchronous or handles its own async
        }

        // file upload widget
        if (feature.startsWith("fs")) {
            await feat_fs(debug_hidden); // This is async
        }


        // TERMINAL
        // Only attempt terminal features if not mobile OR if debug_mobile flag is true
        if (!nuadm || debug_mobile) {
            if (feature === "vt") { // Use exact match for simpleterm
                await feat_vt(debug_hidden); // This is async
                 has_vt = true; // Mark success
                 break; // Process only one terminal type
            }

            if (feature === "vtx") { // Use exact match for xterm.js
                // feat_vtx now includes try...catch and fallback
                await feat_vtx(debug_hidden); // This is async
                 // Check if feat_vtx successfully set up vm.vt.xterm
                 if (vm.vt && vm.vt.xterm && vm.vt.xterm !== console.log) { // console.log is the default fallback
                     has_vt = true; // Mark success IF vtx was actually set up, not fell back
                     break; // Process only one terminal type
                 } else {
                      console.log("feat_vtx failed or fell back, continuing feature processing.");
                 }
            }
            // Note: original code checked feature.startsWith("vt"), which would catch both "vt" and "vtx".
            // Explicitly checking for "vt" and "vtx" as separate cases.

            if (feature === "stdout"){ // Use exact match for simple stdout
                feat_stdout(); // Synchronous
                 has_vt = true; // Mark success (basic terminal)
                 break; // Process only one terminal type
                 // Note: If vtx fails and falls back to stdout, and stdout is *also* in features,
                 // feat_stdout might be called twice. The function should handle this (e.g., check for element existence).
                 // feat_stdout already checks document.getElementById('stdout'), which helps.
            }

        } else {
            console.warn("Skipping terminal features on mobile unless debug_mobile flag is set.");
        }
    } // End feature loop


    // FIXME: forced minimal output until until remote debugger is a thing.
    // If *no* terminal feature was successfully set up (has_vt is still false),
    // and we are in debug_mobile mode, force stdout.
    if ( debug_mobile && !has_vt ) {
        console.warn("Debug mobile mode active, forcing simple stdout output.");
        // Check if stdout feature was already processed or added by a fallback
        if (vm.config.features.indexOf('stdout') === -1) {
             vm.config.features.push('stdout'); // Add to features list conceptually
             feat_stdout(); // Explicitly call it
             has_vt = true; // Now we have a basic terminal
        } else if (!has_vt && vm.vt && vm.vt.xterm && vm.vt.xterm !== console.log) {
             // If stdout was in features but has_vt is false, it might mean feat_stdout didn't set vm.vt.xterm correctly, or it was overridden.
             // Re-call it to ensure vm.vt.xterm is set to the stdout element.
             console.warn("Stdout feature was listed but not active, re-initializing.");
             feat_stdout();
             has_vt = true;
        } else if (!has_vt && (!vm.vt || !vm.vt.xterm || vm.vt.xterm === console.log)) {
             // If still no terminal and not console.log, re-call stdout as a last resort
              console.warn("No terminal successfully initialized, forcing simple stdout.");
              feat_stdout();
              has_vt = true;
         }

    } else if (!has_vt) {
        // If not debug_mobile and no terminal was requested/successful, Python output will go to console.log by default (vm.vt.xterm is initialized to console.log)
        console.warn("No terminal feature requested or successfully initialized. Python output will go to browser console.");
    }


    // Check if window.custom_onload is a function before calling
    if (window.custom_onload && typeof window.custom_onload === 'function') {
        window.custom_onload(debug_hidden);
    }


    window.busy--; // Decrement busy counter

    // Check if vm.vt.xterm is set before writing
    if (vm.vt && vm.vt.xterm && typeof vm.vt.xterm.write === 'function') {
        if (!config.quiet) {
            vm.vt.xterm.write('OK\r\nPlease \x1B[1;3;31mwait\x1B[0m ...\r\n');
        } else {
            console.log("Config quiet=true, suppressing initial 'OK Please wait' message.");
        }
    } else {
        console.warn("Terminal write function not available. Cannot print initial message.");
         // If terminal wasn't set up, at least log to console
         if (!config.quiet) {
             console.log("OK\r\nPlease wait ...");
         }
    }


    // Check if window_resize is defined before calling
    if (typeof window.window_resize === 'function') {
        window_resize(vm.config.gui_divider);
    } else {
        console.warn("window_resize function is not defined.");
    }


    // Cleanup references to functions that are done being used in onload
    feat_snd = feat_gui = feat_fs = feat_vt = feat_vtx = feat_stdout = feat_lifecycle = onload = null;


    if ( is_iframe() ) {
        try {
             // Access window.top cautiously
             if (window.top && window.top.blanker && window.top.blanker.style) {
                window.top.blanker.style.visibility = "hidden";
             } else {
                 console.warn("Could not hide window.top.blanker (element not found or cross-origin restriction).");
             }
        } catch (x) {
            console.error("FIXME: Error accessing window.top.blanker:", x);
        }
    }


    if (!document.getElementById('transfer')) { // Check by ID instead of window.transfer
// <!--
        document.getElementById('html').insertAdjacentHTML('beforeend', `
<style>
    /* Basic styles for the transfer/status area */
    #transfer {
        position: fixed; /* Or absolute depending on layout */
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        background: rgba(0, 0, 0, 0.7); /* Semi-transparent background */
        color: white;
        padding: 10px 0;
        text-align: center;
        z-index: 100; /* Ensure it's above other content */
        pointer-events: none; /* Allow clicks/interactions to pass through */
         box-sizing: border-box;
         display: flex; /* Use flexbox for alignment */
         flex-direction: column; /* Stack items vertically */
         align-items: center; /* Center horizontally */
         justify-content: center; /* Center vertically */
    }
     #transfer div.emscripten {
         margin: 5px 0;
         pointer-events: auto; /* Re-enable pointer events for progress bar/status text */
     }
     #transfer #status {
         font-size: 1em;
     }
     #transfer #progress {
         width: 80%; /* Make progress bar responsive */
         max-width: 400px; /* Max width for large screens */
         height: 20px;
     }
      /* Add basic spinner style if needed */
      /* #spinner { ... } */

</style>
<div id="transfer">
    <div class="emscripten" id="status">Downloading...</div>
    <div class="emscripten">
        <progress value="0" max="200" id="progress"></progress>
    </div>
     <!-- Add spinner element if you have styles for it -->
     <!-- <div class="emscripten" id="spinner"></div> -->
</div>
`);
// -->
    }

// TODO: error alert if 404 / timeout
    console.warn("Loading python interpreter from", config.executable);
     // Check if config.executable is set before importing
     if (config.executable) {
        jsimport(config.executable); // Start loading the main WASM/JS bundle
     } else {
         console.error("Cannot load python interpreter: config.executable is not defined.");
         // Display an error status or alert?
         vm.setStatus("Error: Interpreter path not configured.");
     }

     console.warn("onload End");
}


function auto_conf(cfg) {
    var url = cfg.url;

    console.log("AUTOSTART config. Provided cfg:", cfg); // Log the input cfg

    if (document.currentScript) {
        // This might be misleading if auto_conf is called by loadPyodide
        // and not via a script tag with src.
        // Keeping original logic for now, but note the potential inaccuracy.
        if (document.currentScript.async) {
            console.log("Detected script executing asynchronously", document.currentScript.src);
        } else {
            console.log("Detected script executing synchronously", document.currentScript.src || 'inline');
        }
    } else {
         console.log("document.currentScript is null.");
    }


    const old_url = url; // Store original URL for comparison


    // Ensure url is a string before using rsplit
    url = String(url || ''); // Default to empty string if url is null/undefined

    var elems;

    // Process hash (#) part first
    elems = url.rsplit('#',1);
    url = elems.shift(); // url is now the part before '#'
    if (elems.length) {
         // Process hash part as sys.argv (decoded %20 as spaces)
         const hashArgs = elems.pop();
         vm.sys_argv = []; // Initialize sys_argv
         if (hashArgs) { // Ensure hashArgs is not empty
             for (const arg of hashArgs.split("%20") ) {
                vm.sys_argv.push(decodeURI(arg));
             }
         }
    } else {
        vm.sys_argv = []; // Ensure sys_argv is initialized even if no hash
    }


    // Process query (?) part next
    elems = url.rsplit('?',1);
    url = elems.shift(); // url is now the part before '?'
    if (elems.length) {
        // Process query part as cpy_argv (split by &)
         const queryArgs = elems.pop();
         vm.cpy_argv = []; // Initialize cpy_argv
         if (queryArgs) { // Ensure queryArgs is not empty
             for (const arg of queryArgs.split("&")) {
                 vm.cpy_argv.push(decodeURI(arg));
             }
         }
    } else {
        vm.cpy_argv = []; // Ensure cpy_argv is initialized even if no query
    }


    var code = "";
    // Check if cfg.text is a string and has length
    if (cfg.text && typeof cfg.text === 'string' && cfg.text.length > 0) {
        code = cfg.text;
         console.log("Found inlined script code.");
    } else {
        console.warn("1601: No inlined code found in cfg.text.");
    }


    // --- Interpreter and Paths Configuration ---

    // Resolve python executable cmdline first (from cpy_argv or cfg.python)
    // Default version and interpreter
    const default_version = "3.11";
    var pystr = "python" + default_version; // Default interpreter string

    // Check cpy_argv[0] for interpreter preference
    if (vm.cpy_argv.length > 0 && vm.cpy_argv[0] && typeof vm.cpy_argv[0] === 'string' && vm.cpy_argv[0].search('py') >= 0) {
        pystr = vm.cpy_argv[0];
         console.log(`Interpreter preference from cpy_argv[0]: ${pystr}`);
    } else if (cfg.python && typeof cfg.python === 'string' && cfg.python.search('py') >= 0) {
        // Check cfg.python next
        pystr = cfg.python;
         console.log(`Interpreter preference from cfg.python: ${pystr}`);
    } else {
        // Fallback to default if no preference found
        console.log(`No interpreter preference found, defaulting to: ${pystr}`);
    }

    // Determine interpreter name and build version from pystr
    vm.script = vm.script || {}; // Ensure vm.script exists
    vm.script.interpreter = "cpython"; // Default interpreter name
    config.PYBUILD = default_version; // Default build version

    if (pystr.startsWith('cpython')) {
        vm.script.interpreter = "cpython";
        config.PYBUILD = pystr.substring(7) || default_version;
    } else if (pystr.startsWith('python3')) { // Handle python3 prefix (might be older pygbag)
         vm.script.interpreter = "cpython"; // Still treat as cpython build
         config.PYBUILD = pystr.substring(7) || default_version; // Assume version follows "python3"
         if (config.PYBUILD === "n") config.PYBUILD = default_version; // Handle cases like "python3n"
    }
    else if (pystr.startsWith('pkpy')) {
        vm.script.interpreter = "pkpy";
        config.PYBUILD = pystr.substring(4) || "1.4";
    } else if (pystr.startsWith('wapy')) {
        vm.script.interpreter = "wapy";
        config.PYBUILD = pystr.substring(4) || "3.4"; // Example wapy version
    } else {
         // If pystr didn't match known prefixes, log a warning and use defaults
        console.warn(`Unknown interpreter prefix in "${pystr}". Falling back to default "${vm.script.interpreter}${config.PYBUILD}".`);
         // Defaults are already set above
    }

    // Clean up PYBUILD version string (remove non-digits/dots)
    config.PYBUILD = config.PYBUILD.replace(/[^\d.]/g, '');
    if (!config.PYBUILD) config.PYBUILD = default_version; // Ensure it's not empty

    // Resolve CDN path
    // Running locally (localhost), or is it a specific module URL that needs its own base?
    // The original logic assumes if hostname is localhost or cfg.module is true, CDN is relative to the script dir.
    // Otherwise, it uses the part of the URL before 'pythons.js'.

    // Determine base URL of the script itself (excluding query/hash)
    let scriptBaseUrl = url; // This is the URL after removing ? and #
     if (!scriptBaseUrl && document.currentScript && document.currentScript.src) {
         // If url from cfg was empty/processed away, try current script src
         const currentScriptSrc = document.currentScript.src;
         const srcElems = currentScriptSrc.rsplit('?', 1)[0].rsplit('#', 1)[0];
         // Find the position of module_name in the src
         const moduleIndex = srcElems.lastIndexOf(module_name);
         if (moduleIndex !== -1) {
             scriptBaseUrl = srcElems.substring(0, moduleIndex);
         } else {
             // Fallback to directory of the script if module_name not found
             scriptBaseUrl = currentScriptSrc.substring(0, currentScriptSrc.lastIndexOf('/') + 1);
         }
         console.log("Using currentScript.src base URL:", scriptBaseUrl);

     } else if (!scriptBaseUrl) {
         // Last resort: use the base URL of the document
         scriptBaseUrl = document.location.href.split('?', 1)[0].split('#', 1)[0];
         scriptBaseUrl = scriptBaseUrl.substring(0, scriptBaseUrl.lastIndexOf('/') + 1);
         console.log("Using document base URL:", scriptBaseUrl);
     }


    // Determine config.cdn
    if ( (location.hostname === "localhost") || cfg.module) {
        // If localhost or module mode, CDN is relative to the script's base URL
        config.cdn = scriptBaseUrl;
         console.log("CDN set to script base (localhost or module mode):", config.cdn);
    } else {
        // Otherwise, use the part of the URL *before* module_name (as extracted from original url)
        const moduleIndexInOriginalUrl = old_url.lastIndexOf(module_name);
         if (moduleIndexInOriginalUrl !== -1) {
             config.cdn = old_url.substring(0, moduleIndexInOriginalUrl);
         } else {
             // If module_name not found in original url, fallback to script base
             config.cdn = scriptBaseUrl;
             console.warn(`Could not find "${module_name}" in original script URL "${old_url}". Falling back CDN to script base "${scriptBaseUrl}".`);
         }
         console.log("CDN set based on original URL:", config.cdn);
    }

    // Ensure CDN path ends with a slash if it's not just a filename base
     if (config.cdn && !config.cdn.endsWith('/') && config.cdn.split('/').pop().indexOf('.') === -1) {
          config.cdn += '/';
     }


    config.pydigits = config.pydigits || config.PYBUILD.replace(/\./g, "") || "311"; // Ensure pydigits is set, default to 311 if PYBUILD is odd
    config.executable = config.executable || `${config.cdn}${vm.script.interpreter}${config.pydigits}/main.js`; // Construct executable path


    // --- Resolve Other Configuration Flags ---
    config.xtermjs = config.xtermjs || 0; // Default xtermjs flag
    config.archive = config.archive || (location.search.search(".apk") >= 0) || false; // Default archive flag
    config.debug = config.debug || (location.hash.search("#debug") >= 0) || false; // Default debug flag
    config.interactive = config.interactive || (location.search.search("-i") >= 0) || false; // Default interactive flag (from query)

    // Config from data attributes or cfg object
    config.columns = Number(cfg.columns || 132); // Default columns
    config.lines = Number(cfg.lines || 32); // Default lines
    config.console = Number(cfg.console || 10); // Default console lines

    // Check for fbdev flag in data-os
    config.fbdev = cfg.os && typeof cfg.os === 'string' && cfg.os.search("fbdev") >= 0;


    config.gui_debug = Number(cfg.gui_debug || 2); // Default gui_debug divider

    // Check autorun from cfg.id or cfg.autorun flag
    config.autorun = (config.id === "__main__") || (cfg.autorun !== undefined ? cfg.autorun : 0); // Default autorun if not in cfg

    config.quiet = cfg.quiet !== undefined ? cfg.quiet : false; // Default quiet flag
    config.can_close = cfg.can_close !== undefined ? cfg.can_close : 0; // Default can_close flag
    // config.autorun already handled above


    // Ensure features array is processed correctly from cfg.os or default
    // If cfg.os is a string, split it. Otherwise, use an empty array or default features.
    config.features = (cfg.os && typeof cfg.os === 'string') ? cfg.os.split(",") : (config.features || []); // Use existing config.features as fallback


    config._sdl2 = config._sdl2 || "canvas"; // Default sdl2 target

    if (config.ume_block === undefined) {
        config.ume_block = 1; // Default ume_block
    }

    console.log("Final VM Config:", JSON.stringify(config, null, 2)); // Pretty print final config


    // --- PyConfig setup ---
    // Ensure vm.PyConfig exists before setting properties
    vm.PyConfig = vm.PyConfig || {};

    // Build PyConfig JSON string from determined config values
    const pyConfigData = {
        isolated: 0,
        parse_argv: 0, // We parse argv in JS
        quiet: config.quiet ? 1 : 0, // Map JS boolean to int
        run_filename: vm.PyConfig.frozen || "main.py", // Use frozen path if set, otherwise default
        write_bytecode: 0,
        skip_source_first_line: 1,
        bytes_warning: 1, // Or config.bytes_warning? Defaulting to 1
        base_executable: null, // Let Python determine
        base_prefix: null, // Let Python determine
        buffered_stdio: null, // Let Emscripten/Python manage
        // bytes_warning: 0, // Duplicate key, removed the second one
        warn_default_encoding: 0, // Defaulting to 0
        code_debug_ranges: 1, // Defaulting to 1
        check_hash_pycs_mode: "default",
        configure_c_stdio: 1, // Let Emscripten configure stdio
        dev_mode: config.debug ? 1 : -1, // Map JS debug to dev_mode
        dump_refs: 0, // Defaulting to 0
        exec_prefix: null, // Let Python determine
        executable: config.executable,
        faulthandler: 0, // Defaulting to 0
        filesystem_encoding: "utf-8",
        filesystem_errors: "surrogatepass",
        use_hash_seed: 1, // Defaulting to 1
        hash_seed: 1, // Defaulting to 1
        home: null, // Let Python determine
        import_time: config.import_time ? 1 : 0, // If you add import_time to config
        inspect: config.interactive ? 1 : 0, // Map interactive to inspect
        install_signal_handlers: 0, // Let Emscripten handle signals
        interactive: config.interactive ? 1 : 0, // Map interactive
        legacy_windows_stdio: 0, // Defaulting to 0
        malloc_stats: 0, // Defaulting to 0
        platlibdir: "lib", // Default
        prefix: "/data/data/org.python/assets/site-packages", // Default site-packages path
        ps1: ">J> ", // Default prompts
        ps2: "... "
    };

     // Directly assign the parsed PyConfig object data
    vm.PyConfig = pyConfigData;


    vm.PyConfig.argv = vm.sys_argv; // Use parsed sys_argv
    vm.PyConfig.orig_argv = vm.cpy_argv; // Use parsed cpy_argv


    console.log('Interpreter config:');
    console.log('  interpreter:', vm.script.interpreter);
    console.log('  PYBUILD:', config.PYBUILD);
    console.log('  pydigits:', config.pydigits);
    console.log('  cdn:', config.cdn);
    console.log('  executable:', config.executable);
    console.log('Arguments config:');
    console.log('  orig_argv (from query):', vm.PyConfig.orig_argv);
    console.log('  sys.argv (from hash):' , vm.PyConfig.argv);
    console.log('Source config:');
    console.log('  docurl:', document.location.href);
    console.log('  srcurl:', url);
    if (!cfg.module) {
        console.log('  script id:', cfg.id);
        console.log('  code length:', code.length, `(saved as ${cfg.id}.py)`); // Indicate where code is saved
    } else {
         console.log('  Running as module:', cfg.module);
    }
     console.log('Feature config:');
     console.log('  data-os raw:', cfg.os);
     console.log('  features list:', config.features);
     console.log('  gui_divider:', config.gui_divider);
     console.log('  user_canvas_managed:', config.user_canvas_managed);
     console.log('  fbdev:', config.fbdev);
     console.log('Mode config:');
     console.log('  debug:', config.debug);
     console.log('  interactive:', config.interactive);
     console.log('  quiet:', config.quiet);
     console.log('  autorun:', config.autorun);
     console.log('  archive:', config.archive);
     console.log('  can_close:', config.can_close);
     console.log('  ume_block:', config.ume_block);


     // Store the determined config object back onto vm
    vm.config = config;

    // Store the main script code block(s)
     // Assuming only one main script block from text or module for now
    vm.script.blocks = [ code ];

     // If running as a module, the 'code' might be empty, and the VM needs to be told to run the module name.
     // The PyConfig handles run_filename/run_module.
     // If code is empty and module is specified, update PyConfig.
     if (!code && cfg.module) {
         vm.PyConfig.run_filename = null; // Don't run a file
         vm.PyConfig.run_module = cfg.module; // Run the module
     } else if (code && cfg.id) {
          // If code is provided, assume it's the main script
         vm.PyConfig.run_filename = `/${cfg.id}.py`; // Save as a file in root FS? Or assets? Let's use assets base.
          vm.PyConfig.run_filename = `/data/data/org.python/assets/${cfg.id}.py`; // Consistent with pyrc
          vm.PyConfig.run_module = null;
     } else if (code) {
          // If code is provided but no id, use a default name
          vm.PyConfig.run_filename = `/data/data/org.python/assets/__main_inline__.py`;
          vm.PyConfig.run_module = null;
     } else {
          // If no code and no module, maybe just run pythonrc?
          vm.PyConfig.run_filename = null;
          vm.PyConfig.run_module = null;
          console.warn("No main code or module specified to run.");
     }


     console.log('Final PyConfig:', JSON.stringify(vm.PyConfig, null, 2));

}


function auto_start(cfg_from_loader) {
    window.busy = 1; // Indicate that the page is busy loading

     // If cfg_from_loader is provided, it came from loadPyodide.
     // Otherwise, we need to find the script tag.
    if (cfg_from_loader) {
        console.log("AUTOSTART called by loader (e.g., loadPyodide) with config:", cfg_from_loader);
        // Directly use the provided config
        auto_conf(cfg_from_loader);
        // Assuming the loader handles setting the main script block if needed
        // vm.script.blocks should be set by auto_conf based on cfg_from_loader.text/module

        // Call onload directly as the loader might manage the script import itself
        onload(); // onload is now async, but calling it directly is fine.
        onload = null; // Clear onload reference after calling

    } else {
        console.log("AUTOSTART called by script tag.");
        // Find the script tag that loaded this file
        let scriptTagCfg = null;
        for (const script of document.getElementsByTagName('script')) {
             // Check if it's a module script and its src includes module_name
            if ( (script.type === 'module' || script.type === 'text/python' /* handle other types? */) &&
                 (script.src && script.src.search(module_name) >= 0) ){ // Check for src and module_name

                // Extract config from script tag attributes and content
                 const code = script.text || ""; // Get inline script content

                scriptTagCfg = {
                    module : false, // Assume inline script is not a module unless explicitly set
                    python : script.dataset.python,
                    columns : script.dataset.columns,
                    lines : script.dataset.lines,
                    console : script.dataset.console,
                    url : script.src || document.location.href, // Use script src, fallback to document url
                    os : script.dataset.os || "gui", // Default os to gui
                    text : code, // Inline code
                    id : script.id || "__main__", // Default id
                    autorun : script.dataset.autorun // Check for autorun attribute
                };

                // Process this config
                auto_conf(scriptTagCfg);

                // The main script block is the inline code
                // vm.script.blocks is set by auto_conf now

                // Set onload event listener
                window.addEventListener("load", onload);

                // Found the main script tag, stop searching (assuming only one)
                break;
            } else {
                // console.log("Skipping script tag:", script.type, script.id, script.src );
            }
        }

         // TODO: Process other script tags (e.g., type="text/python") if needed
         // Add logic here to find other script blocks and append them to vm.script.blocks
         // This needs careful design about file naming and execution order.
         // Current logic only handles one main block from the module script tag.

        // If no module script tag with module_name was found, auto_conf might have been called with default empty cfg.
        // If scriptTagCfg is still null here, it means the script wasn't loaded via a standard tag or the tag didn't match.
        if (!scriptTagCfg && !cfg_from_loader) {
             console.error(`AUTOSTART: No script tag with type="module" and src containing "${module_name}" found.`);
             // Maybe display an error message on the page?
             vm.setStatus("Error: Could not find main script tag.");
             window.busy--; // Decrement busy as we can't proceed
        }

    }

     // Clear auto_start reference after it runs the first time
     // Note: This prevents calling it again, which might be intended,
     // but makes loadPyodide only work if called *before* the script tag auto_start runs.
     // If loadPyodide is the *only* way to start, then auto_start shouldn't run by itself.
     // If script tag *or* loadPyodide can start it, this needs adjustment.
     // Let's keep the original behavior for now.
     auto_start = null;

}


window.set_raw_mode = function (param) {
    window.RAW_MODE = param || 0;
     console.log("Raw mode set to:", window.RAW_MODE);
     // If using a terminal (like xterm.js or simpleterm), you would send a control sequence or call a method on the terminal object here
     if (vm.vt && vm.vt.xterm && typeof vm.vt.xterm.setRawMode === 'function') {
          vm.vt.xterm.setRawMode(param);
     } else {
          console.warn("Terminal does not support setRawMode or is not initialized.");
     }
}

