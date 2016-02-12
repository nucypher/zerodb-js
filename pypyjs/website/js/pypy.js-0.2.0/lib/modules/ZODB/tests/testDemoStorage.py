##############################################################################
#
# Copyright (c) 2001, 2002 Zope Foundation and Contributors.
# All Rights Reserved.
#
# This software is subject to the provisions of the Zope Public License,
# Version 2.1 (ZPL).  A copy of the ZPL should accompany this distribution.
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY AND ALL EXPRESS OR IMPLIED
# WARRANTIES ARE DISCLAIMED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST INFRINGEMENT, AND FITNESS
# FOR A PARTICULAR PURPOSE.
#
##############################################################################
from ZODB.DB import DB
from ZODB.tests import (
    BasicStorage,
    HistoryStorage,
    IteratorStorage,
    MTStorage,
    PackableStorage,
    RevisionStorage,
    StorageTestBase,
    Synchronization,
    )

import os
if os.environ.get('USE_ZOPE_TESTING_DOCTEST'):
    from zope.testing import doctest
else:
    import doctest
import random
import re
import transaction
import unittest
import ZODB.DemoStorage
import ZODB.tests.hexstorage
import ZODB.tests.util
import ZODB.utils
from zope.testing import renormalizing


class DemoStorageTests(
    StorageTestBase.StorageTestBase,
    BasicStorage.BasicStorage,

    HistoryStorage.HistoryStorage,
    IteratorStorage.ExtendedIteratorStorage,
    IteratorStorage.IteratorStorage,
    MTStorage.MTStorage,
    PackableStorage.PackableStorage,
    RevisionStorage.RevisionStorage,
    Synchronization.SynchronizedStorage,
    ):

    def setUp(self):
        StorageTestBase.StorageTestBase.setUp(self)
        self._storage = ZODB.DemoStorage.DemoStorage()

    def checkOversizeNote(self):
        # This base class test checks for the common case where a storage
        # doesnt support huge transaction metadata. This storage doesnt
        # have this limit, so we inhibit this test here.
        pass

    def checkLoadDelegation(self):
        # Minimal test of loadEX w/o version -- ironically
        db = DB(self._storage) # creates object 0. :)
        s2 = ZODB.DemoStorage.DemoStorage(base=self._storage)
        self.assertEqual(s2.load(ZODB.utils.z64, ''),
                         self._storage.load(ZODB.utils.z64, ''))

    def checkLengthAndBool(self):
        self.assertEqual(len(self._storage), 0)
        self.assertTrue(not self._storage)
        db = DB(self._storage) # creates object 0. :)
        self.assertEqual(len(self._storage), 1)
        self.assertTrue(self._storage)
        conn = db.open()
        for i in range(10):
            conn.root()[i] = conn.root().__class__()
        transaction.commit()
        self.assertEqual(len(self._storage), 11)
        self.assertTrue(self._storage)

    def checkLoadBeforeUndo(self):
        pass # we don't support undo yet
    checkUndoZombie = checkLoadBeforeUndo


class DemoStorageHexTests(DemoStorageTests):

    def setUp(self):
        StorageTestBase.StorageTestBase.setUp(self)
        self._storage = ZODB.tests.hexstorage.HexStorage(
            ZODB.DemoStorage.DemoStorage())

class DemoStorageWrappedBase(DemoStorageTests):

    def setUp(self):
        StorageTestBase.StorageTestBase.setUp(self)
        self._base = self._makeBaseStorage()
        self._storage = ZODB.DemoStorage.DemoStorage(base=self._base)

    def tearDown(self):
        self._base.close()
        StorageTestBase.StorageTestBase.tearDown(self)

    def _makeBaseStorage(self):
        raise NotImplementedError

    def checkPackOnlyOneObject(self):
        pass # Wrapping demo storages don't do gc

    def checkPackWithMultiDatabaseReferences(self):
        pass # we never do gc
    checkPackAllRevisions = checkPackWithMultiDatabaseReferences

class DemoStorageWrappedAroundMappingStorage(DemoStorageWrappedBase):

    def _makeBaseStorage(self):
        from ZODB.MappingStorage import MappingStorage
        return MappingStorage()

class DemoStorageWrappedAroundFileStorage(DemoStorageWrappedBase):

    def _makeBaseStorage(self):
        from ZODB.FileStorage import FileStorage
        return FileStorage('FileStorageTests.fs')

class DemoStorageWrappedAroundHexMappingStorage(DemoStorageWrappedBase):

    def _makeBaseStorage(self):
        from ZODB.MappingStorage import MappingStorage
        return ZODB.tests.hexstorage.HexStorage(MappingStorage())


def setUp(test):
    random.seed(0)
    ZODB.tests.util.setUp(test)

def testSomeDelegation():
    r"""
    >>> import six
    >>> class S:
    ...     def __init__(self, name):
    ...         self.name = name
    ...     def registerDB(self, db):
    ...         six.print_(self.name, db)
    ...     def close(self):
    ...         six.print_(self.name, 'closed')
    ...     sortKey = getSize = __len__ = history = getTid = None
    ...     tpc_finish = tpc_vote = tpc_transaction = None
    ...     _lock_acquire = _lock_release = lambda self: None
    ...     getName = lambda self: 'S'
    ...     isReadOnly = tpc_transaction = None
    ...     supportsUndo = undo = undoLog = undoInfo = None
    ...     supportsTransactionalUndo = None
    ...     def new_oid(self):
    ...         return '\0' * 8
    ...     def tpc_begin(self, t, tid, status):
    ...         six.print_('begin', tid, status)
    ...     def tpc_abort(self, t):
    ...         pass

    >>> from ZODB.DemoStorage import DemoStorage
    >>> storage = DemoStorage(base=S(1), changes=S(2))

    >>> storage.registerDB(1)
    2 1

    >>> storage.close()
    1 closed
    2 closed

    >>> storage.tpc_begin(1, 2, 3)
    begin 2 3
    >>> storage.tpc_abort(1)

    """

def blob_pos_key_error_with_non_blob_base():
    """
    >>> storage = ZODB.DemoStorage.DemoStorage()
    >>> storage.loadBlob(ZODB.utils.p64(1), ZODB.utils.p64(1))
    Traceback (most recent call last):
    ...
    POSKeyError: 0x01

    >>> storage.openCommittedBlobFile(ZODB.utils.p64(1), ZODB.utils.p64(1))
    Traceback (most recent call last):
    ...
    POSKeyError: 0x01

    """

def load_before_base_storage_current():
    """
    Here we'll exercise that DemoStorage's loadBefore method works
    properly when deferring to a record that is current in the
    base storage.

    >>> import time
    >>> import transaction
    >>> import ZODB.DB
    >>> import ZODB.DemoStorage
    >>> import ZODB.MappingStorage
    >>> import ZODB.utils

    >>> base = ZODB.MappingStorage.MappingStorage()
    >>> basedb = ZODB.DB(base)
    >>> conn = basedb.open()
    >>> conn.root()['foo'] = 'bar'
    >>> transaction.commit()
    >>> conn.close()
    >>> storage = ZODB.DemoStorage.DemoStorage(base=base)
    >>> db = ZODB.DB(storage)
    >>> conn = db.open()
    >>> conn.root()['foo'] = 'baz'
    >>> time.sleep(.1) # Windows has a low-resolution clock
    >>> transaction.commit()

    >>> oid = ZODB.utils.z64
    >>> base_current = storage.base.load(oid)
    >>> tid = ZODB.utils.p64(ZODB.utils.u64(base_current[1]) + 1)
    >>> base_record = storage.base.loadBefore(oid, tid)
    >>> base_record[-1] is None
    True
    >>> base_current == base_record[:2]
    True

    >>> t = storage.loadBefore(oid, tid)

    The data and tid are the values from the base storage, but the
    next tid is from changes.

    >>> t[:2] == base_record[:2]
    True
    >>> t[-1] == storage.changes.load(oid)[1]
    True

    >>> conn.close()
    >>> db.close()
    >>> base.close()
    """

def test_suite():
    suite = unittest.TestSuite((
        doctest.DocTestSuite(
            setUp=setUp, tearDown=ZODB.tests.util.tearDown,
            checker=ZODB.tests.util.checker
            ),
        doctest.DocFileSuite(
            '../DemoStorage.test',
            setUp=setUp,
            tearDown=ZODB.tests.util.tearDown,
            checker=ZODB.tests.util.checker,
            ),
        ))
    suite.addTest(unittest.makeSuite(DemoStorageTests, 'check'))
    suite.addTest(unittest.makeSuite(DemoStorageHexTests, 'check'))
    suite.addTest(unittest.makeSuite(DemoStorageWrappedAroundFileStorage,
                                     'check'))
    suite.addTest(unittest.makeSuite(DemoStorageWrappedAroundMappingStorage,
                                     'check'))
    suite.addTest(unittest.makeSuite(DemoStorageWrappedAroundHexMappingStorage,
                                     'check'))
    return suite
