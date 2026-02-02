import { useEffect, useRef, useState } from "react";
import "./App.css";

const domain = "wss://corymblike-positivistically-nevada.ngrok-free.dev"

function create_ws(route) {
    var ws = new WebSocket(domain + "/" + route);
    return ws
}

function Drawing({ paths }) {
  return (
    <svg width={800} height={800} style={{ border: "1px solid black" }}>
      {paths.map((path, i) => (
        <path
          key={i}
          d={`M ${path.map(p => `${p.x} ${p.y}`).join(" L ")}`}
          stroke="black"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export default function App() {
  const eventSocket = useRef(null);

  const finishedPathsRef = useRef([]);
  const openPaths = new Map();

  const [paths, setPaths] = useState([]);

  const getPoint = (e) => {
    const rect = e.target.getBoundingClientRect();
    return (e.clientX - rect.left).toString() + " " + (e.clientY - rect.top).toString();
  };

  function drawMouseDown(name, point) {
    if (!openPaths.has(name)) {
      openPaths.set(name, [point]);
    } else {
      openPaths.get(name).push(point);
    }
  };

  function drawMouseMove(name, point) {
    if (!openPaths.has(name)) {
      return;
    }
    openPaths.get(name).push(point);

    setPaths(finishedPathsRef.current.concat([...openPaths.values()]));
  };

  function drawMouseUp(name) {
    if (!openPaths.has(name)) {
      return;
    }

    finishedPathsRef.current.push(openPaths.get(name));
    openPaths.delete(name);
    setPaths([...finishedPathsRef.current]);
  };

  function sendMessage(message) {
    if (eventSocket.current?.readyState == WebSocket.OPEN) {
      eventSocket.current?.send(message);
    }
  }
  
  const mouseDown = (e) => {
    sendMessage("mousedown " + getPoint(e));
  };

  const mouseMove = (e) => {
    sendMessage("mousemove " + getPoint(e));
    // TODO: optimize unecessary moves here with a different event
    // representation.
  };

  const mouseUp = () => {
    sendMessage("mouseup");
  };
  

  
  useEffect(() => {
    // set up web sockets
    const socket = create_ws("draw-ws");
    eventSocket.current = socket;
    
    function getInstructionCoordinates(instruction) {
      return {x: parseInt(instruction[2]), y: parseInt(instruction[3])}
    }

    socket.onmessage = function(event) {
      const instruction = event.data.split(" ");
      const username = instruction[0];
      const instructionName = instruction[1];
      switch (instructionName) {
        case "mousedown":
          drawMouseDown(username, getInstructionCoordinates(instruction));
          break;
        case "mousemove":
          drawMouseMove(username, getInstructionCoordinates(instruction));
          break;
        case "mouseup":
          drawMouseUp(username);
          break;
        default:
          console.log("unexpected instruction" + " '" + instruction + "'");
      }
    }
  }, []);
  


  return (
    <div className="App">
       <Drawing paths={paths} />
      <svg
        width={800}
        height={800}
        style={{ position: "absolute", top: 0, left: 0 }}
        onMouseDown={mouseDown}
        onMouseMove={mouseMove}
        onMouseUp={mouseUp}
      />
    </div>
  );
}