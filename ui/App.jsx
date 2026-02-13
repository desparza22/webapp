import { useEffect, useRef, useState } from "react";
import "./App.css";

//const domain = "wss://corymblike-positivistically-nevada.ngrok-free.dev"
const domain = "ws://0.0.0.0:8000"

function create_ws(route) {
    var ws = new WebSocket(domain + "/" + route);
    return ws
}

function pathPointsSvg(paths, stroke, stroke_opacity) {
  return paths.map((path, i) => (
      <path
        key={i}
        d={`M ${path.map(p => `${p.x} ${p.y}`).join(" L ")}`}
        stroke={stroke}
        strokeOpacity={stroke_opacity}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
  ))
}

// TODO: don't need to render every local path, just the ones that haven't been
// synced.
// TODO: separate rerender triggers for previous, current and next frame
function Drawing({frames, rerender_trigger}) {
  const local_paths = frames.getDisplayedPaths(0);
  const synced_paths = frames.getDisplayedPaths(1);
  return (
      <>
      {
        pathPointsSvg(local_paths[0], "red", "0.05")
      }
      {
        pathPointsSvg(synced_paths[0], "red", "0.1")
      }
      {
        pathPointsSvg(local_paths[1], "black", "0.3")

      }
      {
        pathPointsSvg(synced_paths[1], "black", "1")
      }
      {
        pathPointsSvg(local_paths[2], "blue", "0.05")
      }
      {
        pathPointsSvg(synced_paths[2], "blue", "0.1")
      }
      {
        <text x="780" y="590">{frames.display_index}</text>
      }
      </>
  );
}

function Animation({frames}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(frame => frame + 1);
    }, 1000 / 12);

    return () => clearInterval(id);
  })

  const local_paths = frames.getPoints(frame % frames.frames.length, 0);
  const synced_paths = frames.getPoints(frame % frames.frames.length, 1);

  return (
    <>
      {
        pathPointsSvg(local_paths, "black", "0.3")
      }
      {
        pathPointsSvg(synced_paths, "black", "1") 
      }
      {
        <text x="780" y="590">{frame}</text>
      }
    </>
  )
}

function Mouse({mouse_position, rerender_trigger}) {
  return (
      <>      
      {
        mouse_position && (<>
        <circle cx={`${mouse_position.x}`} cy={`${mouse_position.y}`} r="5" stroke="gray" fill="none" /> 
        <circle cx={`${mouse_position.x}`} cy={`${mouse_position.y}`} r="1" stroke="black" /></>)
      }
      </>)
}

class Paths {
  constructor() {
    this.finishedPaths = [];
    this.openPaths = new Map();
  }

  getPathPoints() {
    return this.finishedPaths.concat([...this.openPaths.values()]);
  }

  // returns false, should never cause rerender
  mouseDown(name, point) {
    if (!this.openPaths.has(name)) {
      this.openPaths.set(name, [point]);
    } else {
      this.openPaths.get(name).push(point);
    }
    return false;
  }

  // returns true if paths should be rerendered
  mouseMove(name, point) {
    if (this.openPaths.has(name)) {
      this.openPaths.get(name).push(point);
      return true;
    }
    return false;
  }

  // returns list if paths should be rerendered
  mouseUp(name) {
    if (this.openPaths.has(name)) {
      this.finishedPaths.push(this.openPaths.get(name));
      this.openPaths.delete(name);
      return true;
    }
    return false;
  }
}

class Frame {
  constructor() {
    this.localPaths = new Paths();
    this.syncedPaths = new Paths();
  }

  // TODO: use enum
  getPaths(local_or_synced) {
    if (local_or_synced == 0) {
      return this.localPaths;
    }
    return this.syncedPaths;
  }

  mouseDown(name, point, local_or_synced) {
    const paths = this.getPaths(local_or_synced);
    return paths.mouseDown(name, point);
  }

  mouseMove(name, point, local_or_synced) {
    const paths = this.getPaths(local_or_synced);
    return paths.mouseMove(name, point);
  }

  mouseUp(name, local_or_synced) {
    const paths = this.getPaths(local_or_synced);
    return paths.mouseUp(name, local_or_synced);
  }
}

class Frames {
  constructor() {
    this.frames = [new Frame()];
    this.display_index = 0;
  }

  getFrame(frame_index) {
    while (frame_index >= this.frames.length) {
      this.frames.push(new Frame());
    }
    return this.frames[frame_index];
  }

  getPoints(frame_index, local_or_synced) {
    const frame = this.getFrame(frame_index);
    const paths = frame.getPaths(local_or_synced);
    return paths.getPathPoints();
  }

  getDisplayedPaths(local_or_synced) {
    const displayed_paths = [];
    for (let frame_index = this.display_index - 1; frame_index <= this.display_index + 1; frame_index += 1) {
      if (frame_index < 0) {
        displayed_paths.push([]);
      } else {
        displayed_paths.push(this.getPoints(frame_index, local_or_synced));
      }
    }
    return displayed_paths;
  }

  pageRight() {
    this.display_index += 1;
  }

  pageLeft() {
    if (this.display_index > 0) {
      this.display_index -= 1;
    }
  }

  frameIndexWithinDisplayBounds(frame_index) {
    return frame_index >= this.display_index - 1 && frame_index <= this.display_index + 1
  }

  // TODO only return true if frame_index == display_index (or, if it is within
  // bound, since we'll also faintly display the previous and next frame)
  mouseDown(name, point, frame_index, local_or_synced) {
    const frame = this.getFrame(frame_index);
    return frame.mouseDown(name, point, local_or_synced) && this.frameIndexWithinDisplayBounds(frame_index);
  }

  mouseMove(name, point, frame_index, local_or_synced) {
    const frame = this.getFrame(frame_index);
    return frame.mouseMove(name, point, local_or_synced) && this.frameIndexWithinDisplayBounds(frame_index);
  }

  mouseUp(name, frame_index, local_or_synced) {
    const frame = this.getFrame(frame_index);
    return frame.mouseUp(name, local_or_synced) && this.frameIndexWithinDisplayBounds(frame_index);
  }
}

export default function App() {
  const eventSocket = useRef(null);

  const localPathsIdx = 0;
  const syncedPathsIdx = 1;

  const frames = useRef(new Frames());
  const mouse_position = useRef(null);

  const [rerenderDrawingTrigger, setRerenderDrawingTrigger] = useState(0);
  const [rerenderMouseTrigger, setRerenderMouseTrigger] = useState(0);

  const [animationRunning, setAnimationRunning] = useState(false);

  function playPause() {
    setAnimationRunning(animationRunning => !animationRunning);
  }

  const getPoint = (e) => {
    const rect = e.target.getBoundingClientRect();
    return (e.clientX - rect.left).toString() + " " + (e.clientY - rect.top).toString();
  };

  function triggerDrawingRerender() {
    setRerenderDrawingTrigger(rerenderDrawingTrigger => rerenderDrawingTrigger + 1);
  }

  function triggerMouseRerender() {
    setRerenderMouseTrigger(rerenderMouseTrigger => rerenderMouseTrigger + 1);
  }

  function clickRight() {
    frames.current.pageRight();
    triggerDrawingRerender();
  }

  function clickLeft() {
    frames.current.pageLeft();
    triggerDrawingRerender();
  }

  function mouseDown(name, frame_index, local_or_synced) {
    if (mouse_position.current !== null && frames.current.mouseDown(name, mouse_position.current, frame_index, local_or_synced)) {
      triggerDrawingRerender();
    }
  }

  function mouseMove(name, point, frame_index, local_or_synced) {
    mouse_position.current = point;
    triggerMouseRerender();

    if (frames.current.mouseMove(name, point, frame_index, local_or_synced)) {
      triggerDrawingRerender();
    }
  }

  function mouseUp(name, frame_index, local_or_synced) {
    if (frames.current.mouseUp(name, frame_index, local_or_synced)) {
      triggerDrawingRerender();
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
    const frame_index = instruction[2]
    switch (instructionName) {
      case "mousedown":
        mouseDown(username, frame_index, localPathsIdx);
        break;
      case "mousemove":
        mouseMove(username, getInstructionCoordinates(instruction), frame_index, localPathsIdx);
        break;
      case "mouseup":
        mouseUp(username, frame_index, localPathsIdx);
        break;
      default:
        console.log("unexpected instruction" + " '" + instruction + "'");
    }


    if (eventSocket.current?.readyState == WebSocket.OPEN) {
      eventSocket.current?.send(message);
    }
  }
  
  const onMouseDown = () => {
    sendMessage("mousedown " + frames.current.display_index);
  };

  /*
  use requestPointerLock: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock#browser_compatibility
  to keep mouse locked to center and compute deltas, so we can downscale when the pen is down
  await canvas.requestPointerLock({
    unadjustedMovement: true,
  });
  */
  const onMouseMove = (e) => {
    sendMessage("mousemove " + frames.current.display_index + " " + getPoint(e));
    // TODO: don't send unnecessary moves to server, represent instructions
    // differently. currently each front end independently processes mouse
    // moves, and essentially many get thrown away.
  };

  const onMouseUp = () => {
    sendMessage("mouseup " + frames.current.display_index);
  };

  
  const onKeyDown = (e) => {
    if (e.key == "s") {
      onMouseDown();
    }
  }

  const onKeyUp = (e) => {
    if (e.key == "s") {
      onMouseUp();
    }
  }
  
  useEffect(() => {
    // set up web sockets
    const socket = create_ws("draw-ws");
    eventSocket.current = socket;
    
    socket.onmessage = function(event) {
      const instruction = event.data.split(" ");
      const username = instruction[0];
      const instructionName = instruction[1];
      const frame_index = instruction[2];
      switch (instructionName) {
        case "mousedown":
          mouseDown(username, frame_index, syncedPathsIdx);
          break;
        case "mousemove":
          mouseMove(username, getInstructionCoordinates(instruction), frame_index, syncedPathsIdx);
          break;
        case "mouseup":
          mouseUp(username, frame_index, syncedPathsIdx);
          break;
        default:
          console.log("unexpected instruction" + " '" + instruction + "'");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
      {
        !animationRunning &&
        <>
         <svg width={800} height={600} style={{ border: "1px solid black" }} className="Drawing">
          <Drawing frames={frames.current} rerender_trigger={rerenderDrawingTrigger} />
          <Mouse mouse_position={mouse_position.current} rerender_trigger={rerenderMouseTrigger} />
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
        </>
      }
      {
        animationRunning &&
        <>
         <svg width={800} height={600} style={{ border: "1px solid black" }} className="Drawing">
          <Animation frames={frames.current} />
         </svg>
        </>
      }
      <button onClick={playPause}> Play/Pause </button>
    </div>
  );
}