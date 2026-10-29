#!/usr/bin/env python3
"""Offline HTTP integration tests including simultaneous launch and WASM MIME."""
import http.client
import subprocess
import sys
import time
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def get(port,method='GET',path='/'):
 conn=http.client.HTTPConnection('127.0.0.1',port,timeout=3)
 try:
  conn.request(method,path);response=conn.getresponse()
  result=(response.status,{k.lower():v for k,v in response.getheaders()},response.read() if method=='GET' and path=='/' else b'')
  return result
 finally:conn.close()

class TestLocalServer(unittest.TestCase):
 def test_two_launches_and_static_files(self):
  jobs=[]
  try:
   # Candidate local port is probed with Python; no internet access is required.
   import socket
   with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
   for _ in range(2):
    jobs.append(subprocess.Popen([sys.executable,str(ROOT/'launcher/serve.py'),'--port',str(port),'--no-browser'],stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT,cwd=ROOT))
    time.sleep(.5)
   chosen=[]
   for attempt in range(30):
    chosen=[]
    for c in range(port,port+20):
     try:status,headers,_=get(c,method='HEAD');
     except (OSError,http.client.HTTPException):continue
     if status==200:chosen.append(c)
    if len(chosen)>=2:break
    time.sleep(.2)
   self.assertGreaterEqual(len(chosen),2,'Concurrent launcher did not use a free port')
   for port in chosen[:2]:
    status,headers,body=get(port);self.assertEqual(status,200);self.assertIn('CHESS ATELIER PRO',body.decode('utf-8'))
    status,headers,_=get(port,method='HEAD',path='/vendor/stockfish-19-single.wasm')
    self.assertEqual(status,200);self.assertIn('application/wasm',headers['content-type']);self.assertGreater(int(headers['content-length']),90_000_000)
    for path in ('/', '/index.html', '/src/main.js?v=2.0.2', '/styles/pro.css'):
     status,headers,_=get(port,method='HEAD',path=path)
     self.assertEqual(status,200,path)
     self.assertIn('no-store',headers.get('cache-control',''),path)
    status,headers,_=get(port,method='HEAD',path='/src/data/puzzles.js');self.assertEqual(status,200)
  finally:
   for p in jobs:p.terminate()
   for p in jobs:
    try:p.wait(timeout=3)
    except subprocess.TimeoutExpired:p.kill()

if __name__=='__main__':unittest.main()
