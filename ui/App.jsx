import { useEffect, useRef, useState } from "react";
import "./App.css";

//const domain = "wss://corymblike-positivistically-nevada.ngrok-free.dev"
const domain = "ws://0.0.0.0:8000"

function create_ws(route) {
    var ws = new WebSocket(domain + "/" + route);
    return ws
}

// TODO: don't need to render every local path, just the ones that haven't been
// synced.
function Drawing({local_paths, synced_paths, mouse_position, frame_index}) {
  return (
      <>
      {local_paths.map((local_path, i) => (
        <path
          key={i}
          d={`M ${local_path.map(p => `${p.x} ${p.y}`).join(" L ")}`}
          stroke="gray"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {synced_paths.map((synced_path, i) => (
        <path
          key={i}
          d={`M ${synced_path.map(p => `${p.x} ${p.y}`).join(" L ")}`}
          stroke="black"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {
        mouse_position && (<>
        <circle cx={`${mouse_position.x}`} cy={`${mouse_position.y}`} r="5" stroke="gray" fill="none" /> 
        <circle cx={`${mouse_position.x}`} cy={`${mouse_position.y}`} r="1" stroke="black" /></>)
      }
      {
        <text x="780" y="590">{frame_index}</text>
      }
      </>
  );
}

class Paths {
  constructor() {
    this.finishedPaths = [];
    this.openPaths = new Map();
  }

  // returns null, should never cause rerender
  mouseDown(name, point) {
    if (!this.openPaths.has(name)) {
      this.openPaths.set(name, [point]);
    } else {
      this.openPaths.get(name).push(point);
    }
    return null;
  }

  // returns list if paths should be rerendered
  mouseMove(name, point) {
    if (this.openPaths.has(name)) {
      this.openPaths.get(name).push(point);
      return this.finishedPaths.concat([...this.openPaths.values()]);
    }
    return null;
  }

  // returns list if paths should be rerendered
  mouseUp(name) {
    if (this.openPaths.has(name)) {
      this.finishedPaths.push(this.openPaths.get(name));
      this.openPaths.delete(name);
      return [...this.finishedPaths];
    }
    return null;
  }
}

export default function App() {
  const eventSocket = useRef(null);

  const localPathsIdx = 0;
  const syncedPathsIdx = 1;

  const frames = useRef([[new Paths(), new Paths()]]);
  const [frameIdx, setFrameIdx] = useState(0);

  const [paths, setPaths] = useState([[], []]);

  const [mousePosition, setMousePosition] = useState(null);

  const getPoint = (e) => {
    const rect = e.target.getBoundingClientRect();
    return (e.clientX - rect.left).toString() + " " + (e.clientY - rect.top).toString();
  };


  function setPathsToFrameIndex(frame_idx) {
    const localSyncedPaths = frames.current[frame_idx];
    setPaths([localSyncedPaths[0].finishedPaths.concat([...localSyncedPaths[0].openPaths.values()]), localSyncedPaths[1].finishedPaths.concat([...localSyncedPaths[1].openPaths.values()])]);
  }

  function clickRight() {
    if (frameIdx == frames.current.length - 1) {
      frames.current.push([new Paths(), new Paths()]);
    }
    const currFrameIdx = frameIdx;
    setFrameIdx(frameIdx => frameIdx + 1);
    setPathsToFrameIndex(currFrameIdx + 1);
  }

  function clickLeft() {
    if (frameIdx != 0) {
      const currFrameIdx = frameIdx;
      setFrameIdx(frameIdx => frameIdx - 1);
      setPathsToFrameIndex(currFrameIdx - 1);
    }
  }

  // TODO: take a frame to update index
  function mouseDown(name, point, frame_idx, localSyncedIndex) {
    frames.current[frame_idx][localSyncedIndex].mouseDown(name, point);
  }

  function mouseMove(name, point, frame_idx, localSyncedIndex) {
    setMousePosition(point);

    const result = frames.current[frame_idx][localSyncedIndex].mouseMove(name, point);
    if (frame_idx == frameIdx && result !== null) {
      setPathsToFrameIndex(frame_idx);
    }
  }

  function mouseUp(name, frame_idx, localSyncedIndex) {
    const result = frames.current[frame_idx][localSyncedIndex].mouseUp(name);
    console.log("comparison on mouse up " + frame_idx + " " + frameIdx);
    if (frame_idx == frameIdx && result !== null) {
      console.log("setting paths to frame idx");
      setPathsToFrameIndex(frame_idx);
    }
  }


  function getInstructionCoordinates(instruction) {
    return {x: parseInt(instruction[3]), y: parseInt(instruction[4])}
  }

  function sendMessage(message) {
    // TODO: dedup instruction parsing and move sending
    const instruction = ("local " + message).split(" ");
    const username = instruction[0];
    const instructionName = instruction[1];
    const frame_idx = instruction[2]
    switch (instructionName) {
      case "mousedown":
        mouseDown(username, getInstructionCoordinates(instruction), frame_idx, localPathsIdx);
        break;
      case "mousemove":
        mouseMove(username, getInstructionCoordinates(instruction), frame_idx, localPathsIdx);
        break;
      case "mouseup":
        mouseUp(username, frame_idx, localPathsIdx);
        break;
      default:
        console.log("unexpected instruction" + " '" + instruction + "'");
    }


    if (eventSocket.current?.readyState == WebSocket.OPEN) {
      eventSocket.current?.send(message);
    }
  }
  
  const onMouseDown = (e) => {
    sendMessage("mousedown " + frameIdx + " " + getPoint(e));
  };

  const onMouseMove = (e) => {
    sendMessage("mousemove " + frameIdx + " " + getPoint(e));
    // TODO: optimize unecessary moves here with a different event
    // representation.
  };

  const onMouseUp = () => {
    sendMessage("mouseup " + frameIdx);
  };
  

  
  useEffect(() => {
    // set up web sockets
    const socket = create_ws("draw-ws");
    eventSocket.current = socket;
    
    socket.onmessage = function(event) {
      const instruction = event.data.split(" ");
      const username = instruction[0];
      const instructionName = instruction[1];
      const frame_idx = instruction[2];
      switch (instructionName) {
        case "mousedown":
          mouseDown(username, getInstructionCoordinates(instruction), frame_idx, syncedPathsIdx);
          break;
        case "mousemove":
          mouseMove(username, getInstructionCoordinates(instruction), frame_idx, syncedPathsIdx);
          break;
        case "mouseup":
          mouseUp(username, frame_idx, syncedPathsIdx);
          break;
        default:
          console.log("unexpected instruction" + " '" + instruction + "'");
      }
    }
  }, []);

  // TODO: add file saving like this
  /*
  const [fileHandle, setFileHandle] = useState(null);
  async function chooseSaveLocation() {

    const handle = await window.showSaveFilePicker({
      suggestedName: "drawing.svg",
      types: [
        {
          description: "SVG",
          accept: {"image/svg+xml": [".svg"]}
        }
      ]
    });

    setFileHandle(handle);
  }


  // add this to the returned html
      <button onClick={chooseSaveLocation}>
        Save as...
      </button>
    */


  return (
    // TODO: combine the overlayed svgs. doing it naively messes up the mouse
    // location though
    <div className="App">
      <svg width={800} height={600} style={{ border: "1px solid black" }} className="Drawing">
       <Drawing local_paths={paths[localPathsIdx]} synced_paths={paths[syncedPathsIdx]} mouse_position={mousePosition} frame_index={frameIdx} />
      </svg>
      <svg
        width={800}
        height={600}
        style={{ position: "absolute", top: 0, left: 0 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        className="Drawing">
      </svg>
      <button onClick={clickLeft}> Left </button>
      <button onClick={clickRight}> Right </button>
    </div>
  );
}