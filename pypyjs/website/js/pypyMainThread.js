importScripts('/js/pypy.js-0.2.0/lib/Promise.min.js');
importScripts('/js/pypy.js-0.2.0/lib/pypy.js');

pipes = new Array();
pipes_by_id = new Object();
processes = new Object();
processes.nextid=1;
sockets = new Array();


function mainThreadEval(s){
    self.postMessage({cmd:'eval',data:s});
}

function FLOBuffer(pipeid){
    if (pipeid==undefined){
        pipes.push(this);
        self.postMessage({cmd:'create Pipe'});
    }
    else{
        pipes_by_id[pipeid]=this;
        this.id=pipeid;
        self.postMessage({cmd:'watch pipe', id:this.id});
    }
    this.buffer = '';
}

FLOBuffer.prototype.requestData = function(amt){
    self.postMessage({cmd:'request data for pipe', id:this.id, data:amt});
};

FLOBuffer.prototype.sendData=function(bytes){
    self.postMessage({cmd:'data for pipe', id:this.id, data:bytes});
};

FLOBuffer.prototype.data=function(bytes){
    this.buffer+=bytes;
};

FLOBuffer.prototype.setID=function(id){
    this.id=id;
    pipes_by_id[id]=this;
    self.postMessage({cmd:'watch pipe', id:this.id});
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
            this.buffer.requestData(amt);
            while (this.buffer.buffer==''){
                Sleep(0.1);
            }
            var ret = this.buffer.buffer.substring(0, amt);
            if (!amt){
                this.buffer.buffer='';
            }
            else{
                this.buffer.buffer=this.buffer.buffer.substring(amt);
            }
            return ret;
        }
    }
}


FLOPipe.prototype.fileno=function(){
    return this.fno;
};

function pipe(pipeid){
    this.buffer = new FLOBuffer(pipeid);
    this.read_end=new FLOPipe(false,true, this.buffer);
    this.write_end=new FLOPipe(true,false, this.buffer);
}

function fork(obj){
    var newProc = {};
    newProc.id=processes.nextid++;
    processes[newProc.id]=newProc;
    self.postMessage({cmd:'fork', data:obj, id:newProc.id});
    newProc.stdin=function(e){
        self.postMessage({cmd: 'subprocess stdin', data:e, id:newProc.id});
    };
    newProc.stderr={}
    newProc.stderr.queue=new Array();
    newProc.stderr.write=function(msg){
        newProc.stderr.queue.push(msg);
    };
    newProc.stderr.read=function(n){
        var txt=newProc.stderr.queue.join('');
        var ret = txt.substring(0,n);
        txt = txt.substring(n);
        newProc.stderr.queue.length=1;
        newProc.stderr.queue[0]=txt;
        return ret
    };
    newProc.stdout={};
    newProc.stdout.queue=new Array();
    newProc.stdout.write=function(msg){
        newProc.stdout.queue.push(msg);
    };
    newProc.stdout.read=function(n){
        var txt=newProc.stdout.queue.join('');
        var ret = txt.substring(0,n);
        txt = txt.substring(n);
        newProc.stdout.queue.length=1;
        newProc.stdout.queue[0]=txt;
        return ret
    };
    newProc.exit=vm.stdout;
    return newProc;
}



stdout = function(data) {
        self.postMessage({cmd:'stdout', msg:''+data});
};

stderr = function(data){
    self.postMessage({cmd:'stderr', msg:''+data});
};

function Semaphore(m){
    this.maxvalue=m;
    this.value=0;
    this.handle=128;
}

Semaphore.prototype.acquire=function(){
    this.value++;
    if (this.value>this.maxvalue){
        this.value--;
        return false;
    }
    return true;
};
Semaphore.prototype.release=function(){
    this.value--;
};
Semaphore.prototype.__enter__ = Semaphore.prototype.acquire;
Semaphore.prototype.__exit__ = Semaphore.prototype.release;

Semaphore.prototype._get_value = function(){
    return this.value;
};



function socketConnect(server){
    var this_socket = {}
    this_socket.id = sockets.length;
    sockets.push(this_socket);
    this_socket.queue=new Array();
    self.postMessage({cmd:'create WebSocket', server:server, id:this_socket.id});
    
    this_socket.send=function(txt){
        self.postMessage({cmd:'data for socket', data:txt, id:this_socket.id});
    }
    this_socket.onrecv=function(msg){
        this_socket.queue.push(msg);
        };
    this_socket.ready=false;
    this_socket.closed=false;
    return this_socket
}

function Sleep(delay){
    //self.postMessage({cmd:"start sleep"});
    try{
        var r = new XMLHttpRequest();
        r.timeout=delay*1000;
        r.open('GET', '/sleep/'+delay, false);
        r.send(null);
    }catch(e){
    }
    
    
    return null;
}




var vm = new PyPyJS();
vm.stdout = stdout;
vm.stderr = stderr




vm.stdout('Loading PyPy.js.\n')
vm.stdout('It\'s big, so this might take a while...\n\n')



vm.ready.then(function() {
    self.postMessage({cmd:'reset'});
    vm.stdout('Welcome to PyPy.js!\n');
    vm.eval('import pickle,time,js;time.sleep=lambda x:[js.globals["Sleep"](x),None][1];');
    vm.eval('import code;c = code.InteractiveConsole()').then(function() {
        self.postMessage({cmd:'ready'});
    });
    vm.eval('import time,js;time.sleep=lambda x:[js.globals["Sleep"](x),None][1];');
    vm.eval('import sys');
    vm.eval('import StringIO')
    vm.eval('import sys,StringIO\nclass fifoFile(object):\n\
               buffer=StringIO.StringIO()\n\
               def readline(self):\n\
                 self.buffer.seek(0)\n\
                 line = self.buffer.readline()\n\
                 self.buffer.buf=self.buffer.buf[len(line):]\n\
                 self.buffer.read()\n\
                 return line\n\nsys.stdin = fifoFile()');
    vm.eval('stdinwrapper=js.Function(sys.stdin.buffer.write)');
    vm.eval('js.globals["vm"].stdin=stdinwrapper');
    
    
}, 
function(err) {
        self.postMessage({cmd:'alert', msg:'had an error before ready'});
      });
        

evals=new Array();

self.addEventListener('message', function(e){
    var data=e.data;
    switch (data.cmd){
        case 'execfile':
            if (data.script!=null){
                vm.eval("c.push('''execfile('"+data.script+"')''')");
            }
            break;
        case 'code':
            vm.eval(data.code).then(function(){
                vm.get('r').then(function(r){
                    if (r){
                        self.postMessage({cmd:'setPrompt',data:'... '});
                    }
                    else {
                        self.postMessage({cmd:'setPrompt',data:'>>> '});
                    }
                })
            });
            break;
        case 'message from socket':
            sockets[data.id].onrecv(data.data);
            break;
        case 'socket opened':
            sockets[data.id].ready=true;
            break;
        case 'socket closed':
            sockets[data.id].ready=false;
            sockets[data.id].closed=true;
            break;
        case 'subprocess stdout':
            if (processes[data.id]!=null){
                processes[data.id].stdout.write(data.msg);
            }
            break;
        case 'subprocess stderr':
            if (processes[data.id]!=null){
                processes[data.id].stderr.write(data.msg);
            }
            break;
        case 'subprocess exit':
            processes[data.id].exit(data.msg);
            break;
        case 'created pipe':
            pipes.pop().setID(data.data);
            break;
        case 'data for pipe':
            pipes_by_id[data.id].data(data.data);
            break;
        case 'set buffer':
            pipes_by_id[data.id].buffer=(data.data);
            break;
        case 'eval return':
            evals.push(data.data);
            break;
        }
}
);
