from twisted.web.server import Site
from twisted.web.static import File
from twisted.internet import reactor
import time

class Root(File):
    def getChild(self, path, request):
        if path=='sleep':
            delay=float(request.postpath[0])
            time.sleep(delay)
            return super(Root, self).getChild(path, request)
        return super(Root,self).getChild(path,request)

resource = Root('website')
factory = Site(resource)
reactor.listenTCP(8080, factory)
reactor.run()
