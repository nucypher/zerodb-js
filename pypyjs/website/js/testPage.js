// import Nevow.Athena
// import Divmod.Runtime
// import PyPyWorker


TestPage = Nevow.Athena.Widget.subclass("TestPage");
TestPage.methods(
    function __init__(self, node) {
        TestPage.upcall(self, '__init__', node);
        self.callRemote('echo','hello world');
        self.vm = new PyPyJSWorker();
        self.vm.ready = function(){
            self.vm.postMessage({cmd:"execfile", script:'/lib/pypyjs/lib_pypy/autostart.py'});
              //doPrompt();
        };
        self.vm.reset=function(){console.clear();};
        self.vm.start();
        console.log(self.vm);
    },
    function echo(self, args){
        console.log(args);
    }
);
