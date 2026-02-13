import asyncio
from typing import Annotated
import random

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles


app = FastAPI()


with open("ravens.webp", "rb") as favicon_reader:
    favicon = favicon_reader.read()
        

@app.get("/favicon.ico",
         responses = {
             200: {
                 "content": {"image/png": {}}
             }
         },
         response_class = Response)
def get_favicon():
    return Response(content=favicon, media_type="image/png")

def random_name():
    constonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm']
    vowels = ['a', 'e', 'i', 'o', 'u']
    name = ""
    for _ in range(3):
       name += random.choice(constonants)
       name += random.choice(vowels) 
    return name

class Connections:
    def __init__(self):
        self.connections = {}
        
    async def connect(self, websocket:WebSocket):
        await websocket.accept()
        name = None
        while not name or name in self.connections:
            name = random_name()

        self.connections[name] = websocket
        return name 

    async def send_to(self, connection, message):
        #await asyncio.sleep(0.02)
        await connection.send_text(message)
        
        
    async def reply(self, name, data):
        for connection in self.connections.values():
            await self.send_to(connection, f"{name} {data}")
                
    async def disconnect(self, name):
        del self.connections[name]
            
manager = Connections()
        

@app.websocket("/draw-ws")
async def do_websockets(websocket : WebSocket):
    name = await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.reply(name, data)
    except WebSocketDisconnect:
        await manager.disconnect(name)
        
        
app.mount("/", StaticFiles(directory="ui/dist", html=True), name="ui")
