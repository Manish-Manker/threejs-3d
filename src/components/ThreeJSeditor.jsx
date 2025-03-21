import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib";

// Error messages
const ERROR_MESSAGES = {
  MODEL_LOAD: "Failed to load 3D model. Please try again with a valid .glb file.",
  TEXTURE_LOAD: "Failed to load texture. Please try again with a valid image file.",
  NO_MESH_SELECTED: "Please select a mesh before applying a texture.",
  INVALID_FILE: "Invalid file format.",
  RENDERER_ERROR: "Failed to initialize 3D renderer.",
};

// Add ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "red", padding: "20px" }}>
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Create a memo-ed status message component
const StatusMessage = memo(({ message, type }) => {
  if (!message) return null;
  
  const style = {
    padding: "10px",
    margin: "10px 0",
    borderRadius: "4px",
    backgroundColor: type === "error" ? "#ffebee" : "#e8f5e9",
    color: type === "error" ? "#c62828" : "#2e7d32",
  };

  return <div style={style}>{message}</div>;
});

const ThreeJSeditor = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const DlightRef = useRef(null);
  const planeRef = useRef(null);
  const [modelFile, setModelFile] = useState(null);
  const [model, setModel] = useState(null);
  const [defaultModel, setDefaultModel] = useState(null);
  const [lightPosition, setLightPosition] = useState({ x: -4, y: 2, z: 5 });
  const [shadowOpacity, setShadowOpacity] = useState(0.3);
  const [shadowBlur, setShadowBlur] = useState(1);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  
  // Debounced texture loader
  const textureLoader = useRef(new THREE.TextureLoader());
  const loadTexture = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        textureLoader.current.load(
          e.target.result,
          (texture) => {
            texture.flipY = false;
            texture.minFilter = THREE.LinearFilter;
            texture.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() || 1;
            texture.colorSpace = THREE.SRGBColorSpace;
            resolve(texture);
          },
          undefined,
          (error) => reject(error)
        );
      };
      reader.onerror = () => reject(new Error(ERROR_MESSAGES.TEXTURE_LOAD));
      reader.readAsDataURL(file);
    });
  }, []);

  // Modified handleTextureChange with error handling
  const handleTextureChange = async (event) => {
    if (!selectedMesh) {
      setError(ERROR_MESSAGES.NO_MESH_SELECTED);
      return;
    }

    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(ERROR_MESSAGES.INVALID_FILE);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const texture = await loadTexture(file);
      selectedMesh.material.map = texture;
      selectedMesh.material.needsUpdate = true;
      setStatus("Texture applied successfully!");
    } catch (err) {
      setError(ERROR_MESSAGES.TEXTURE_LOAD);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Modified model loading with error handling
  const loadModel = useCallback((gltf) => {
    try {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Improve material quality
          if (child.material) {
            child.material.precision = "highp";
            child.material.roughness = 0.2;
            if (child.material.map) {
              child.material.map.anisotropy =
                rendererRef.current.capabilities.getMaxAnisotropy();
              child.material.map.minFilter = THREE.LinearFilter;
              child.material.map.magFilter = THREE.LinearFilter;
              child.material.map.generateMipmaps = true;
              child.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        }
      });

      sceneRef.current.add(gltf.scene);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      gltf.scene.position.sub(center);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / maxDim;
      gltf.scene.scale.set(scale, scale, scale);
      const newBox = new THREE.Box3().setFromObject(gltf.scene);
      const newCenter = newBox.getCenter(new THREE.Vector3());
      gltf.scene.position.sub(newCenter);
      setStatus("Model loaded successfully!");
      return gltf.scene;
    } catch (err) {
      setError(ERROR_MESSAGES.MODEL_LOAD);
      console.error(err);
      return null;
    }
  }, []);

  // Modified file change handler with validation
  const handleFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.glb')) {
      setError(ERROR_MESSAGES.INVALID_FILE);
      return;
    }

    setLoading(true);
    setError(null);
    setModelFile(file);
    setSelectedMesh(null);
  };

  // Clear status message after 3 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Add error handling to useEffect
  useEffect(() => {
    try {
      const currentMount = mountRef.current;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xdddddd);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(55, 1, 1, 1000);
      camera.position.set(0, 0, 2);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        preserveDrawingBuffer: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(760, 760);
      renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      currentMount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const ambientLight = new THREE.AmbientLight(0x404040, 40.0);
      scene.add(ambientLight);

      RectAreaLightUniformsLib.init();

      const rectLight1 = new THREE.RectAreaLight(0xffffff, 0.5, 5, 5);
      rectLight1.position.set(0, 1, 6);
      rectLight1.lookAt(0, 0, 0);
      scene.add(rectLight1);

      const Dlight = new THREE.DirectionalLight(0xffffff, 1);
      Dlight.position.set(lightPosition.x, lightPosition.y, lightPosition.z);
      Dlight.castShadow = true;
      Dlight.target.position.set(0, 0, 0);
      scene.add(Dlight);
      scene.add(Dlight.target);

      Dlight.shadow.mapSize.width = 1224;
      Dlight.shadow.mapSize.height = 824;
      Dlight.shadow.camera.near = 0.5;
      Dlight.shadow.camera.far = 500; // Set a fixed shadow depth
      Dlight.shadow.bias = -0.0001; // Reduce shadow artifacts
      Dlight.shadow.radius = shadowBlur;

      DlightRef.current = Dlight;

      const rectLight2 = new THREE.RectAreaLight(0xffffff, 0.5, 5, 5);
      rectLight2.position.set(0, 1, -6);
      rectLight2.lookAt(0, 0, 0);
      scene.add(rectLight2);

      const rectLight3 = new THREE.RectAreaLight(0xffffff, 0.5, 5, 5);
      rectLight3.position.set(-6, 1, 0);
      rectLight3.lookAt(0, 0, 0);
      scene.add(rectLight3);

      const rectLight4 = new THREE.RectAreaLight(0xffffff, 0.5, 5, 5);
      rectLight4.position.set(6, 1, 0);
      rectLight4.lookAt(0, 0, 0);
      scene.add(rectLight4);

      const rectLight = new THREE.RectAreaLight(0xffffff, 0.5, 5, 5);
      rectLight.position.set(0, 4, 0);
      rectLight.lookAt(0, 0, 0);
      scene.add(rectLight);

      const rectLightB = new THREE.RectAreaLight(0xffffff, 0.5, 5, 5);
      rectLightB.position.set(0, -4, 0);
      rectLightB.lookAt(0, 0, 0);
      scene.add(rectLightB);

      const planeGeometry = new THREE.PlaneGeometry(500, 500);
      const planeMaterial = new THREE.ShadowMaterial({ opacity: shadowOpacity });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.75; // Adjust the plane position to remove the gap
      plane.receiveShadow = true;
      planeRef.current = plane;
      scene.add(plane);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      const loader = new GLTFLoader();

      if (!modelFile) {
        loader.load("/Cylinder.glb", (gltf) => {
          const modelScene = loadModel(gltf);
          setDefaultModel(modelScene);
          setModel(modelScene);
        });
      }

      if (modelFile) { 
        if (defaultModel) {
          scene.remove(defaultModel);
          setDefaultModel(null);
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          loader.parse(event.target.result, "", (gltf) => {
            const modelScene = loadModel(gltf);
            setModel(modelScene);
          });
        };
        reader.readAsArrayBuffer(modelFile);
      }

      const animate = () => {
        controls.update();
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        if (currentMount) {
          currentMount.removeChild(renderer.domElement);
        }
        window.removeEventListener("resize", handleResize);
        setDefaultModel(null);
        renderer.dispose();
      };
    } catch (err) {
      setError(ERROR_MESSAGES.RENDERER_ERROR);
      console.error(err);
    }
  }, [modelFile]);

  useEffect(() => {
    if (model) {
      setSelectedMesh(null); // Reset selected mesh when model changes
    }
  }, [model]);

  const handleMeshSelection = (event) => {
    const selectedMeshName = event.target.value;

    if (model) {
      const mesh = model.getObjectByName(selectedMeshName);
      setSelectedMesh(mesh);
    }
  };

  const handleDownloadImage = (format) => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;

    const originalBackground = scene.background;
    scene.background = null;

    if (format === "png") {
      renderer.render(scene, camera);
      const link = document.createElement("a");
      link.href = renderer.domElement.toDataURL("image/png");
      link.download = "model.png";
      link.click();
    }
    scene.background = originalBackground;
  };

  const handleLightPositionChange = (axis, value) => {
    setLightPosition((prev) => {
      const newPosition = { ...prev, [axis]: value };
      if (DlightRef.current) {
        DlightRef.current.position.set(
          newPosition.x,
          newPosition.y,
          newPosition.z
        );
        DlightRef.current.target.position.set(0, 0, 0);
      }
      return newPosition;
    });
  };

  const handleShadowOpacityChange = (value) => {
    const newOpacity = parseFloat(value);
    setShadowOpacity(newOpacity);
    if (planeRef.current) {
      planeRef.current.material.opacity = newOpacity;
      planeRef.current.material.needsUpdate = true;
    }
  };

  const handleShadowBlurChange = (value) => {
    const newBlur = parseInt(value);
    setShadowBlur(newBlur);
    if (DlightRef.current) {
      DlightRef.current.shadow.radius = newBlur;
      // DlightRef.current.material.needsUpdate = true;
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ display: "flex", alignContent: "space-between" }}>
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
          {error && <StatusMessage message={error} type="error" />}
          {status && <StatusMessage message={status} type="success" />}
          {loading && <div>Loading...</div>}
          <input
            type="file"
            accept=".glb"
            onChange={handleFileChange}
            style={{ marginBottom: "10px" }}
            disabled={loading}
          />
          <div style={{ marginBottom: "10px" }}>
            <label>
              Select Mesh:
              <select
                onChange={handleMeshSelection}
                style={{ marginLeft: "10px" }}
                disabled={loading}
              >
                <option value="">Select a mesh</option>
                {model &&
                  model.children
                    .filter((child) => child.isMesh)
                    .map((child) => (
                      <option key={child.name} value={child.name}>
                        {child.name}
                      </option>
                    ))}
              </select>
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>Texture:</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleTextureChange}
              style={{ marginLeft: "10px" }}
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Light X: 
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={lightPosition.x}
                onChange={(e) => handleLightPositionChange("x", e.target.value)}
                style={{ marginLeft: "10px", verticalAlign: "middle" }}
                disabled={loading}
              />
              {lightPosition.x}
            </label>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Light Y: 
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={lightPosition.y}
                onChange={(e) => handleLightPositionChange("y", e.target.value)}
                style={{ marginLeft: "10px", verticalAlign: "middle" }}
                disabled={loading}
              />
              {lightPosition.y}
            </label>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Light Z: 
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={lightPosition.z}
                onChange={(e) => handleLightPositionChange("z", e.target.value)}
                style={{ marginLeft: "10px", verticalAlign: "middle" }}
                disabled={loading}
              />
              {lightPosition.z}
            </label>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Shadow Opacity: 
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={shadowOpacity}
                onChange={(e) => handleShadowOpacityChange(e.target.value)}
                style={{ marginLeft: "10px", verticalAlign: "middle" }}
                disabled={loading}
              />
              {shadowOpacity}
            </label>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Shadow Blur: 
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={shadowBlur}
                onChange={(e) => handleShadowBlurChange(e.target.value)}
                style={{ marginLeft: "10px", verticalAlign: "middle" }}
                disabled={loading}
              />
              {shadowBlur}
            </label>
          </div>
          <button
            onClick={() => handleDownloadImage("png")}
            style={{ marginBottom: "10px" }}
            disabled={loading}
          >
            Download PNG
          </button>
        </div>
        <div
          ref={mountRef}
          style={{
            width: "100%",
            height: "100%",
            padding: "20px",
            boxSizing: "border-box",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
      </div>
    </ErrorBoundary>
  );
};

export default memo(ThreeJSeditor);
