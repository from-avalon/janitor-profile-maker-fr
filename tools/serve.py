#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Static file server for the studio.

This exists instead of `python -m http.server` for one reason: that server sends
no Cache-Control, so Chrome falls back to heuristic caching and will happily go
on running a stale copy of a .js file you just edited, with no error to explain
why your change did nothing. Everything here is served no-store.

Run:  python tools/serve.py [port]
"""

import os
import sys
from functools import partial

try:
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
except ImportError:                                    # Python 3.6 and older
    from http.server import SimpleHTTPRequestHandler
    from socketserver import ThreadingTCPServer as ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):
        # One line per request is noise; only surface failures.
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("%s %s\n" % (args[1], args[0]))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = partial(Handler, directory=ROOT)
    server = ThreadingHTTPServer(("", port), handler)
    print("JanitorAI Profile CSS Studio -> http://localhost:%d/" % port)
    print("serving %s (caching disabled)" % ROOT)
    print("Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
