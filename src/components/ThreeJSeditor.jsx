// this is optimize code but need some changes

import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib";

// Custom hook for cleanup
const useCleanup = (refs) => {
  useEffect(() => {
    return () => {
      Object.values(refs).forEach(ref => {
        if (ref?.current?.dispose) {
          ref.current.dispose();
        }
        if (ref?.current?.material?.dispose) {
          ref.current.material.dispose();
        }
        if (ref?.current?.geometry?.dispose) {
          ref.current.geometry.dispose();
        }
      });
    };
  }, []);
};

// Performance optimized component
const ThreeJSeditor = memo(() => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const DlightRef = useRef(null);
  const planeRef = useRef(null);
  const [modelFile, setModelFile] = useState(null);
  const [model, setModel] = useState(null);
  const [defaultModel, setDefaultModel] = useState(null);
  const [lightPosition, setLightPosition] = useState({ x: -4, y: 4, z: 5 });
  const [shadowOpacity, setShadowOpacity] = useState(0.3);
  const [shadowBlur, setShadowBlur] = useState(1);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const [modelBounds, setModelBounds] = useState(null);
  const [modelColor, setModelColor] = useState("#ffffff");
  const [colorChanged, setColorChanged] = useState(false);
  const [colorableMeshes, setColorableMeshes] = useState([]);
  const [selectedColorMesh, setSelectedColorMesh] = useState(null);

  const animationFrameId = useRef(null);
  const controlsRef = useRef(null);

  // Cleanup resources
  useCleanup({
    scene: sceneRef,
    renderer: rendererRef,
    plane: planeRef,
    model: model
  });

  // Optimize renderer settings
  const rendererSettings = useMemo(() => ({
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
    powerPreference: "high-performance",
    logarithmicDepthBuffer: true,
    precision: "highp"
  }), []);

  // Optimized scene initialization
  const initScene = useCallback(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);
    return scene;
  }, []);

  // Optimized model loading
  const loadModel = useCallback((gltf) => {
    const scene = sceneRef.current;
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.precision = "highp";
          child.material.roughness = 0.25;
          if (child.material.map) {
            const texture = child.material.map;
            texture.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy();
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.generateMipmaps = true;
            texture.needsUpdate = true;
          }
        }
      }
    });

    scene.add(gltf.scene);

    // Center and scale model
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    // const size = box.getSize(new THREE.Vector3());
    // const maxDim = Math.max(size.x, size.y, size.z);
    // const scale = 1.5 / maxDim; // Adjust scale factor

    // gltf.scene.scale.set(scale, scale, scale);
    gltf.scene.position.sub(center);
    gltf.scene.updateMatrixWorld(true);

    setModelBounds(box);
    updatePlanePosition(box);

    scene.needsRender = true;

    return gltf.scene;
  }, []);

  // Optimized animation loop
  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    controlsRef.current?.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameId.current = requestAnimationFrame(animate);
  }, []);

  // Optimize texture loading
  const loadTexture = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const texture = new THREE.TextureLoader().load(e.target.result);
        texture.flipY = false;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = rendererRef.current.capabilities.getMaxAnisotropy();
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        resolve(texture);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Optimize handlers
  const handleTextureChange = useCallback(async (event) => {
    if (!selectedMesh) return;

    const file = event?.target.files[0];
    if (!file) return;

    try {
      if (selectedMesh.material.map) {
        selectedMesh.material.map.dispose();
      }

      const texture = await loadTexture(file);
      selectedMesh.material.map = texture;
      selectedMesh.material.needsUpdate = true;
      sceneRef.current.needsRender = true;
    } catch (error) {
      console.error('Error loading texture:', error);
    }
  }, [selectedMesh, loadTexture]);

  // Main effect with optimizations
  useEffect(() => {
    const currentMount = mountRef.current;

    const scene = initScene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(65, 1 , 0.1, 1000);
    camera.position.set(0, 0, 2); // Move camera back and up
    // camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer(rendererSettings);
    renderer.setSize(1024, 1024);
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

    Dlight.shadow.mapSize.width = 1024;
    Dlight.shadow.mapSize.height = 1024;
    Dlight.shadow.camera.near = 0.01;
    Dlight.shadow.camera.far = 800; // Set a fixed shadow depth
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

    const planeGeometry = new THREE.PlaneGeometry(1024, 1024);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: shadowOpacity });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    planeRef.current = plane;

    // Initial position - will be updated when model loads
    if (modelBounds) {
      updatePlanePosition(modelBounds);
    }
    scene.add(plane);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    const loader = new GLTFLoader();
    if (!modelFile) {
      loader.load("/BCAA Supplement Container Black.glb", (gltf) => {
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

    animate();

    const handleResize = () => {
      // const width = currentMount.clientWidth;
      // const height = currentMount.clientHeight;

      // camera.aspect = width / height;
      // camera.updateProjectionMatrix();

      // renderer.setSize(width, height);
      // renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
  }, [modelFile, initScene, animate, rendererSettings]);

  useEffect(() => {
    if (DlightRef.current) {
      DlightRef.current.position.set(
        lightPosition.x,
        lightPosition.y,
        lightPosition.z
      );
    }
  }, [lightPosition]);

  useEffect(() => {
    if (planeRef.current) {
      planeRef.current.material.opacity = shadowOpacity;
    }
  }, [shadowOpacity]);

  useEffect(() => {
    if (planeRef.current) {
      planeRef.current.material.needsUpdate = true;
    }
  }, [shadowBlur]);

  useEffect(() => {
    if (model) {
      setSelectedMesh(null); // Reset selected mesh when model changes
    }
  }, [model]);

  useEffect(() => {
    if (modelBounds) {
      updatePlanePosition(modelBounds);
    }
  }, [modelBounds]);

  useEffect(() => {
    if (model) {
      const meshesWithoutTexture = [];
      const texturemesh = [];
      model.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            if (child.material.some(mat => !mat.map)) {
              meshesWithoutTexture.push(child);
            }
          } else if (child.material && !child.material.map) {
            meshesWithoutTexture.push(child);
          } else {
            texturemesh.push(child);
          }
        }
      });
      setColorableMeshes(meshesWithoutTexture);
    }
  }, [model]);

  const handleFileChange = (event) => {
    setModelFile(event.target.files[0]);
    setSelectedMesh(null);
    setColorChanged(false); // Reset color changed flag for new model
  };

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
    }
  };

  const handleColorChange = (event) => {
    const newColor = event.target.value;
    setModelColor(newColor);

    if (selectedColorMesh && selectedColorMesh.isMesh) {
      if (Array.isArray(selectedColorMesh.material)) {
        selectedColorMesh.material.forEach(mat => {
          if (!mat.map) {
            mat.color.setStyle(newColor);
            mat.needsUpdate = true;
          }
        });
      } else if (selectedColorMesh.material && !selectedColorMesh.material.map) {
        selectedColorMesh.material.color.setStyle(newColor);
        selectedColorMesh.material.needsUpdate = true;
      }
    }
  };

  const handleColorMeshSelect = (event) => {
    const meshName = event.target.value;
    const selected = colorableMeshes.find(mesh => mesh.name === meshName);
    setSelectedColorMesh(selected);
  };

  const updatePlanePosition = (bounds) => {
    if (!planeRef.current || !bounds) return;
    const modelHeight = bounds.max.y - bounds.min.y;
    const offset = modelHeight * 0.5;
    planeRef.current.position.y = bounds.min.y - offset;
  };

  return (
    <>
      <div style={{ display: "flex", alignContent: "space-between" }}>
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
          <label>
            Select Model:
            <input
              type="file"
              accept=".glb"
              onChange={handleFileChange}
              style={{ marginBottom: "10px" }}
            />
          </label>
          <div style={{ marginBottom: "10px" }}>
            <label>
              Select Mesh for Texture:
              <select
                onChange={handleMeshSelection}
                style={{ marginLeft: "10px" }}
                value={selectedMesh?.name || ""}
              >
                <option value="">Select mesh</option>
                {model && model.children
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
              />
              {" " + lightPosition.x}
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
              />
              {" " + lightPosition.y}
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
              />
              {" " + lightPosition.z}
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
              />
              {" " + shadowOpacity}
            </label>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Shadow Blur:
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={shadowBlur}
                onChange={(e) => handleShadowBlurChange(e.target.value)}
                style={{ marginLeft: "10px", verticalAlign: "middle" }}
              />
              {" " + shadowBlur}
            </label>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label>
              Select Mesh to Color:
              <select
                onChange={handleColorMeshSelect}
                style={{ marginLeft: "10px", marginRight: "10px" }}
                value={selectedColorMesh?.name || ""}
              >
                <option value="">Select mesh</option>
                {colorableMeshes.map((mesh) => (
                  <option key={mesh.name} value={mesh.name}>
                    {mesh.name}
                  </option>
                ))}
              </select>
              <input
                type="color"
                value={modelColor}
                onChange={handleColorChange}
                disabled={!selectedColorMesh}
                style={{ verticalAlign: "middle" }}
              />
            </label>
          </div>
          <button
            onClick={() => handleDownloadImage("png")}
            style={{ marginBottom: "10px" }}
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
    </>
  );
});

ThreeJSeditor.displayName = 'ThreeJSeditor';

// Error boundary wrapper
class ThreeJSErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <div>Error loading 3D viewer: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

// Export wrapped component
export default function SafeThreeJSeditor() {
  return (
    <ThreeJSErrorBoundary>
      <ThreeJSeditor />
    </ThreeJSErrorBoundary>
  );
}
