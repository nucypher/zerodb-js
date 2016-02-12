

importScripts('/js/pypy.js-0.2.0/lib/Promise.min.js');
importScripts('/js/pypy.js-0.2.0/lib/pypy.js');




function mainThreadEval(s){
    self.postMessage({cmd:'eval',data:s});
}


pipes = new Array();
pipes_by_id = new Object();




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
    this.data = function(bytes){
        this.buffer+=bytes;
    }
    this.sendData = function(bytes){
        self.postMessage({cmd:'data for pipe', id:this.id, data:bytes});
    }
    this.requestData = function(amt){
        self.postMessage({cmd:'request data for pipe', id:this.id, data:amt});
    }
}

FLOBuffer.prototype.setID=function(id){
    this.id=id;
    pipes_by_id[id]=this;
    self.postMessage({cmd:'watch pipe', id:this.id});
}

FLOBuffer.prototype.fileno=function(){
    return this.id;
}



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



function pipe(pipeid){
    this.buffer = new FLOBuffer(pipeid);
    this.read_end=new FLOPipe(false,true, this.buffer);
    this.write_end=new FLOPipe(true,false, this.buffer);
    
}



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
}
Semaphore.prototype.release=function(){
    this.state--;
}
Semaphore.prototype.__enter__ = Semaphore.prototype.acquire;
Semaphore.prototype.__exit__ = Semaphore.prototype.release;

threads = new Array();
sockets = new Array();



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
    self.processingMessages=false;
    while (self.processingMessages){
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





function initializeVM(data){
    vm = new PyPyJS();
    vm.stdout=function(msg){
        self.postMessage({cmd:'stdout', id:self.id, msg:''+msg});
    }
    vm.stderr=function(msg){
        self.postMessage({cmd:'stderr', id:self.id, msg:''+msg});
    }
    vm.ready.then(function() {
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
                vm.eval('c.push("""multiprocessing.forking.Popen(o, True)\n""")');});
        });
    
    }, 
    function(err) {
            vm.stderr(err)
    });
}


evals = new Array();
        



self.addEventListener('message', function(e){
    var data=e.data;
    switch (data.cmd){
        case 'subprocess upstart':
            self.id=data.id;
            initializeVM(data.data);
            break;
        case 'subprocess stdin':
            vm.stdin(data.msg);
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
