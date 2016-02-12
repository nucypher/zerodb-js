{
    function PyPyJSWorker() {
        var pipes = this.pipes = new Array();
        this.webSockets = new Object();
        this.subprocesses = new Object();
        function Pipe() {
            this.id = pipes.length;
            this.buffer = '';
            this.watchers = new Array();
            pipes.push(this);
        }
        Pipe.prototype.dataIn = function (bytes) {
            this.buffer += bytes;
            for (var idx in this.watchers) {
                var w = this.watchers[idx];
                w.postMessage({cmd: 'data for pipe', id: this.id, data: bytes});
            }
        };
        Pipe.prototype.request = function (amt, worker) {
            //worker.postMessage({cmd:'data for pipe', id:this.id, data:this.buffer.substring(0,amt)});
            this.buffer = this.buffer.substring(amt);
            if (!amt) {
                this.buffer = '';
            }
            for (var w_idx in this.watchers) {
                var w = this.watchers[w_idx];
                w.postMessage({cmd: 'set buffer', id: this.id, data: this.buffer});
            }
        };
        this.Pipe = Pipe;
    }
    PyPyJSWorker.prototype.start=function(){
        this.worker = new Worker('js/pypyMainThread.js');
        this.worker.handler=this;
        this.worker.addEventListener('message', this.eventListener);
    };
    PyPyJSWorker.prototype.eventListener = function (event) {
        if (this.handler[event.data.cmd] != undefined) {
            this.handler[event.data.cmd](event.data);
        }
    };

    PyPyJSWorker.prototype.postMessage = function (msg) {
        return this.worker.postMessage(msg);
    };

    PyPyJSWorker.prototype.addHandler = function (name, handler) {
        this[name] = handler;
    };


    PyPyJSWorker.prototype['create WebSocket'] = function (data) {
        var worker=this.worker;
        var this_socket = new WebSocket(data.server);
        this.webSockets[data.id] = this_socket;
        this_socket.onmessage = function (e) {
            worker.postMessage({cmd: 'message from socket', data: e.data, id: data.id});
        };
        this_socket.onopen = function (e) {
            worker.postMessage({cmd: 'socket opened', id: data.id});
        };
        this_socket.onclose = function (e) {
            worker.postMessage({cmd: 'socket closed', id: data.id});
        };

    };

    PyPyJSWorker.prototype['data for socket'] = function (data) {
        var this_socket = this.webSockets[data.id];
        if (this_socket.readyState == 1) {
            this_socket.send(data.data);
        }
        else if (this_socket.readyState == 0) {
            var ooo = this_Socket.onopen;
            this_socket.onopen = function (e) {
                ooo(e);
                this_socket.send(data.data);
            }
        }
        else {
            this.postMessage({cmd: 'socket send failed', id: data.id, reason: 'socket closed'});
        }
    };

    PyPyJSWorker.prototype.fork = function(data) {
        if (data.id==1){
            this.subprocesses[data.id] = new PyPyDrawThread(this, data);
        }
        else{
            this.subprocesses[data.id] = new PyPyJS_Subprocess(this, data);
        }
    };

    PyPyJSWorker.prototype['subprocess stdin']=function(data){
        this.subprocesses[data.id].postMessage({cmd:'subprocess stdin', msg:data.msg});
    };

    PyPyJSWorker.prototype['create Pipe']=function(data){
        this.postMessage({cmd:'created pipe', data:(new this.Pipe()).id});
    };
    PyPyJSWorker.prototype['data for pipe']=function(data){
        this.pipes[data.id].dataIn(data.data);
    };
    PyPyJSWorker.prototype['request data for pipe'] = function (data) {
        this.pipes[data.id].request(data.data, this);
    };
    PyPyJSWorker.prototype['watch pipe'] = function (data) {
        if (this.pipes[data.id].watchers.indexOf(this)==-1){
            this.pipes[data.id].watchers.push(this);
        }
    };
    PyPyJSWorker.prototype.eval=function(data){
        this.postMessage({cmd:'eval return', data:""+eval(data.data)});
    }
    PyPyJSWorker.prototype.stdout=function(data){
        console.log(data.msg);
    }
    PyPyJSWorker.prototype.stderr=function(data){
        this.stderrbuffer=this.stderrbuffer||'';
        this.stderrbuffer+=data.msg;
        if (data.msg=='\n'){
            console.error(this.stderrbuffer);
            this.stderrbuffer='';
        }
    }
}

{
    function PyPyJS_Subprocess(parent, data) {
        this.parent = parent;
        this.id = data.id;
        this.worker = new Worker('/js/pypySubprocess.js');
        this.worker.handler=this;
        this.worker.postMessage({cmd: 'subprocess upstart', data: data.data, id: data.id});
        this.worker.addEventListener('message', this.eventListener);
    }

    PyPyJS_Subprocess.prototype.eventListener = function (event) {
        if (this.handler[event.data.cmd] != undefined) {
            this.handler[event.data.cmd](event.data);
        }
    };

    PyPyJS_Subprocess.prototype.stdout = function (data) {
        this.parent.postMessage({cmd: 'subprocess stdout', id: this.id, msg: data.msg});
    };

    PyPyJS_Subprocess.prototype.stderr = function (data) {
        this.parent.postMessage({cmd: 'subprocess stderr', id: this.id, msg: data.msg});
    };

    PyPyJS_Subprocess.prototype.exit = function (data) {
        this.parent.postMessage({cmd: 'subprocess exit', id: this.id, code: data.code});
    };

    PyPyJS_Subprocess.prototype['request data for pipe'] = function (data) {
        this.parent.pipes[data.id].request(data.data, this);
    };

    PyPyJS_Subprocess.prototype['watch pipe'] = function (data) {
        this.parent.pipes[data.id].watchers.push(this);
        this.postMessage({cmd: 'data for pipe', id: data.id, data: this.parent.pipes[data.id].buffer});
    };

    PyPyJS_Subprocess.prototype['data for pipe']=function(data){
        this.parent.pipes[data.id].dataIn(data.data);
    };

    PyPyJS_Subprocess.prototype.eval = function (data) {
        this.postMessage({cmd: 'eval return', data: eval(data.data)});
    };

    PyPyJS_Subprocess.prototype.postMessage = function (msg) {
        return this.worker.postMessage(msg);
    };

    PyPyJS_Subprocess.prototype['create Pipe']=function(data){
        this.postMessage({cmd:'created pipe', data:(new this.parent.Pipe()).id});
    };

}
    
    
