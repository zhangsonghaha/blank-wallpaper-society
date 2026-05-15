#!/usr/bin/env python3
"""Helper to generate base64 encoded JS for agent-browser eval -b"""
import base64, sys
js = sys.argv[1] if len(sys.argv) > 1 else ""
print(base64.b64encode(js.encode()).decode())