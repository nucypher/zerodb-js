

importScripts('js/pypy.js-0.2.0/lib/Promise.min.js');
importScripts('js/pypy.js-0.2.0/lib/pypy.js');








function Semaphore(m){
    this.max=m;
    this.state=0;
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
        self.postMessage({cmd:'stdout', id:self.id, msg:msg});
    }
    vm.stderr=function(msg){
        self.postMessage({cmd:'stderr', id:self.id, msg:msg});
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
        vm.eval('import pickle;o = pickle.loads(sys.stdin.read());import multiprocessing,multiprocessing.forking;multiprocessing.forking.Popen(o, True)');
    });
    
    }, 
    function(err) {
            
    });
}



        



self.addEventListener('message', function(e){
    var data=e.data;
    switch (data.cmd){
        case 'subprocess upstart':
            self.id=data.id;
            initializeVM(data.data);
            break;
        case 'subprocess stdin':
            vm.stdin(data.msg);
    }
}
);
