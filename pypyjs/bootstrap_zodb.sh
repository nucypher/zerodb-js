#!/bin/bash
# Not needed here, it is just to start playing with pypyjs + ZODB

mkdir zodb_modules
cd zodb_modules
git clone https://github.com/kelp404/six.git
git clone https://github.com/zero-db/persistent.git
git clone https://github.com/zopefoundation/zope.interface.git
git clone https://github.com/zopefoundation/zodbpickle.git
git clone https://github.com/zopefoundation/transaction.git
git clone https://github.com/zopefoundation/BTrees.git
git clone https://github.com/zopefoundation/ZODB.git
git clone https://github.com/zopefoundation/ZEO.git
cd ..
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules ZODB
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules BTrees
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules persistent
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules transaction
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules zope
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules six
python tools/module_bundler.py remove website/js/pypy.js-0.2.0/lib/modules zodbpickle
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/zope.interface/src/zope
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/persistent/persistent
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/transaction/transaction
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/BTrees/BTrees
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/six/six.py
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/zodbpickle/src/zodbpickle
python tools/module_bundler.py add website/js/pypy.js-0.2.0/lib/modules zodb_modules/ZODB/src/ZODB
