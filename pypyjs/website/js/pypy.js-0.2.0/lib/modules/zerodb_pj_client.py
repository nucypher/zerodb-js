import socket
import sys

try:
    import cPickle as pickle
except ImportError:
    import pickle

try:
    import ujson as json
except ImportError:
    import json


def encode(*args):
    return pickle.dumps(args, protocol=0)

decode = pickle.loads


class ZeroDBClient(object):
    def __init__(self, addr):
        self.sock = socket.socket()
        self.serial = 0
        self.sock.connect(addr)

    def close(self):
        self.sock.close()

    def call(self, name, *args):
        self.sock.send(json.dumps({"call": "zeo." + name, "arguments": [encode(*args)], "serial": self.serial}))
        self.serial += 1
        out = self.sock.recv(10000)
        return out
