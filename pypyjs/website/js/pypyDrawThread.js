//PyPyDrawThread = (function() {
    function PyPyDrawThread(parent, data) {
        PPDT = this;
        this.parent = parent;
        this.pipes_by_id = {};
        this.sockets = [];
        this.id = data.id;
        this.initializeVM(data.data);

    }

    PyPyDrawThread.prototype.stdout = function (msg) {
        this.parent.postMessage({cmd: 'subprocess stdout', id: this.id, msg: msg});
    };

    PyPyDrawThread.prototype.stderr = function (msg) {
        this.parent.postMessage({cmd: 'subprocess stderr', id: this.id, msg: msg});
    };

    PyPyDrawThread.prototype.exit = function (code) {
        this.parent.postMessage({cmd: 'subprocess exit', id: this.id, code: code});
    };

    PyPyDrawThread.prototype.postMessage = function (data) {
        if (this[data.cmd] != undefined) {
            this[data.cmd](data);
        }
    };

    PyPyDrawThread.prototype['request data for pipe'] = function (data) {
        this.parent.pipes[data.id].request(data.data, this);
    };

    PyPyDrawThread.prototype['watch pipe'] = function (data) {
        this.parent.pipes[data.id].watchers.push(this);
        this.postMessage({cmd: 'data for pipe', id: data.id, data: this.parent.pipes[data.id].buffer});
    };

    PyPyDrawThread.prototype['data for pipe'] = function (data) {
        this.parent.pipes[data.id].dataIn(data.data);
    };

    PyPyDrawThread.prototype.eval = function (data) {
        this.postMessage({cmd: 'eval return', data: eval(data.data)});
    };



    function FLOBuffer(pipeid) {
        if (pipeid == undefined) {
            var pipe = PPDT.parent.Pipe();
            this.setID(pipe.id);
        }
        else {
            this.setID(pipeid);
        }
    }
    FLOBuffer.prototype.data=function data(bytes){
        this.buffer+=bytes;
    };
    FLOBuffer.prototype.sendData=function sendData(bytes){
        PPDT.parent.pipes[this.id].dataIn(bytes);
    };
    FLOBuffer.prototype.requestData=function requestData(amt){
        var ret = this.buffer.substring(0, amt);
        PPDT.parent.pipes[this.id].request(amt, this);
        return ret
    };

    FLOBuffer.prototype.setID=function(id){
        this.id=id;
        PPDT.pipes_by_id[id]=this;
        PPDT.parent.pipes[this.id].watchers.push(this);
        this.buffer=PPDT.parent.pipes[this.id].buffer;
    };
    FLOBuffer.prototype.postMessage=function(data){
        if (data.cmd=='set buffer'){
            this.buffer=data.data;
        }
        else{
            this.buffer+=data.data;
        }
    };

    FLOBuffer.prototype.fileno=function(){
        return this.id;
    };

    function FLOPipe(writable, readable, buffer){
        this.buffer=buffer;
        if (writable){
            this.write=function(data){
                this.buffer.sendData(data);
            }
        }
        if (readable){
            this.read=function(amt){
                return this.buffer.requestData(amt);
            }
        }
    }
    function pipe(pipeid){
        this.buffer = new FLOBuffer(pipeid);
        this.read_end=new FLOPipe(false,true, this.buffer);
        this.write_end=new FLOPipe(true,false, this.buffer);

    }


    function socketConnect(server){
        var this_socket = {};
        this_socket.id = sockets.length;
        sockets.push(this_socket);
        this_socket.queue=[];
        self.postMessage({cmd:'create WebSocket', server:server, id:this_socket.id});

        this_socket.send=function(txt){
            self.postMessage({cmd:'data for socket', data:txt, id:this_socket.id});
        };
        this_socket.onrecv=function(msg){
            this_socket.queue.push(msg);
            };
        this_socket.ready=false;
        this_socket.closed=false;
        return this_socket
    }

    function Sleep(delay){
        //self.postMessage({cmd:"start sleep"});
        processingMessages=false;
        while (processingMessages){
            try{
                var r = new XMLHttpRequest();
                r.timeout=delay*1000;
                r.open('GET', '/sleep/'+delay, false);
                r.send(null);

            }catch(e){
            }
        }
        return null;
    }
    PyPyDrawThread.prototype.initializeVM = function initializeVM(data){
        console.log('initializing second pypy vm');
        this.vm = vm = new PyPyJS();
        vm.parent=this;
        vm.stdout=function(msg){
            this.parent.stdout(msg);
        };
        vm.stderrbuffer='';
        vm.stderr=function(msg){
            this.parent.stderr(msg);
        };
        vm.ready.then(function() {
            vm.eval('import js\nprint js.globals["pipe"]\nprint js.eval("pipe")');
            vm.eval('import multiprocessing');
            vm.eval('import time,js;time.sleep=lambda x:[js.globals["Sleep"](x),None][1];');
            vm.eval('import sys');
            vm.eval('import StringIO');
            vm.eval('import sys,StringIO\nclass fifoFile(object):\n\
                       buffer=StringIO.StringIO()\n\
                       def readline(self):\n\
                         self.buffer.seek(0)\n\
                         line = self.buffer.readline()\n\
                         self.buffer.buf=self.buffer.buf[len(line):]\n\
                         self.buffer.read()\n\
                         return line\n\
                       def close(self): pass\n\
                       def read(self, *args, **kw):\n\
                         self.buffer.seek(0)\n\
                         line=self.buffer.read(*args, **kw)\n\
                         self.buffer.buf=self.buffer.buf[len(line):]\n\
                         self.buffer.read()\n\
                         return line\n');
            vm.eval('sys.stdin = fifoFile()');
            vm.eval('stdinwrapper=js.Function(sys.stdin.buffer.write)');
            vm.eval('js.globals["vm"].stdin=stdinwrapper').then(function(){
                vm.stdin(data);
                vm.eval('import pickle,code');
                vm.eval('c=code.InteractiveConsole();c.push("""import pickle,code,sys;o = pickle.loads(sys.stdin.read());import multiprocessing,multiprocessing.forking;\n""")').then(function(){
                    vm.eval('c.push("""multiprocessing.forking.Popen(o, True)\n""")');
                });
            });

        },
        function(err) {
                vm.stderr(err)
        });
        return vm;
    }
//    return PyPyDrawThread;
//})();


function Semaphore(m){
    this.maxvalue=m;
    this.value=0;
    this.handle=128;
}

Semaphore.prototype.acquire=function(){
    this.state++;
    if (this.state>this.max){
        this.state--;
        return false;
    }
    return true;
};
Semaphore.prototype.release=function(){
    this.state--;
};
Semaphore.prototype.__enter__ = Semaphore.prototype.acquire;
Semaphore.prototype.__exit__ = Semaphore.prototype.release;
