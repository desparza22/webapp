from typing import Annotated
import random

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, HTMLResponse

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

        for connection in self.connections.values():
            await connection.send_text(f"{name} joined")
        
        other_names = list(self.connections.keys())
        others = "an empty chat" if len(other_names) == 0 else ", ".join(other_names)
        self.connections[name] = websocket
        await websocket.send_text(f"You're connected as {name}. You joined {others}")
        return name 
        
    async def reply(self, name, data):
        await self.connections[name].send_text(f"You sent: {data}")
        for other_name, connection in self.connections.items():
            if other_name != name:
                await connection.send_text(f"{name} sent: {data}")
                
    async def disconnect(self, name):
        del self.connections[name]
        for connection in self.connections.values():
            await connection.send_text(f"{name} left")
            
manager = Connections()
        

@app.websocket("/ws")
async def do_websockets(websocket : WebSocket):
    name = await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.reply(name, data)
    except WebSocketDisconnect:
        await manager.disconnect(name)
        
        
        
html = """
<!DOCTYPE html>
<html>
    <head>
        <title>Chat</title>
    </head>
    <body>
        <h1>Chat with friends</h1>
        <form action="" onsubmit="sendMessage(event)">
            <input type="text" id="messageText" autocomplete="off"/>
            <button>Send</button>
        </form>
        <ul id='messages'>
        </ul>
        <script>
            var ws = new WebSocket("wss://corymblike-positivistically-nevada.ngrok-free.dev/ws");
            ws.onmessage = function(event) {
                var messages = document.getElementById('messages')
                var message = document.createElement('li')
                var content = document.createTextNode(event.data)
                message.appendChild(content)
                messages.appendChild(message)
            };
            function sendMessage(event) {
                var input = document.getElementById("messageText")
                ws.send(input.value)
                input.value = ''
                event.preventDefault()
            }
        </script>
    </body>
</html>
"""

@app.get("/")
def root():
    return HTMLResponse(html)
