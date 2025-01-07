import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib";

const ThreeJSeditor = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const [modelFile, setModelFile] = useState(null);
  const [model, setModel] = useState(null);
  const [defaultModel, setDefaultModel] = useState(null);

  useEffect(() => {
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, 1, 1, 1000);
    camera.position.set(0, 0, 2); // Adjust the camera position
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: true,
    });
    renderer.setSize(760, 760);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add ambient light for natural lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 50.0); // soft white light
    scene.add(ambientLight);

    // Add RectAreaLight from four directions
    RectAreaLightUniformsLib.init();

    const rectLight1 = new THREE.RectAreaLight(0xffffff, 1, 5, 5);
    rectLight1.position.set(0, 1, 6);
    rectLight1.lookAt(0, 0, 0);
    scene.add(rectLight1);
    // scene.add(new RectAreaLightHelper(rectLight1));

    const rectLight2 = new THREE.RectAreaLight(0xffffff, 1, 5, 5);
    rectLight2.position.set(0, 1, -6);
    rectLight2.lookAt(0, 0, 0);
    scene.add(rectLight2);
    // scene.add(new RectAreaLightHelper(rectLight2));

    const rectLight3 = new THREE.RectAreaLight(0xffffff, 1, 5, 5);
    rectLight3.position.set(-6, 1, 0);
    rectLight3.lookAt(0, 0, 0);
    scene.add(rectLight3);
    // scene.add(new RectAreaLightHelper(rectLight3));

    const rectLight4 = new THREE.RectAreaLight(0xffffff, 1, 5, 5);
    rectLight4.position.set(6, 1, 0);
    rectLight4.lookAt(0, 0, 0);
    scene.add(rectLight4);
    // scene.add(new RectAreaLightHelper(rectLight4));

    const light = new THREE.HemisphereLight(0xffffff, 0x080820, 2);
    scene.add(light);

    const rectLight = new THREE.RectAreaLight(0xffffff, 2, 5, 5);
    rectLight.position.set(0, 4, 0);
    rectLight.lookAt(0, 0, 0);
    scene.add(rectLight);

    const rectLightB = new THREE.RectAreaLight(0xffffff, 1, 5, 5);
    rectLightB.position.set(0, -4, 0);
    rectLightB.lookAt(0, 0, 0);
    scene.add(rectLightB);
    // scene.add(new RectAreaLightHelper(rectLightB));

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // controls.autoRotate = true; // auto-rotate
    // controls.autoRotateSpeed = 3; // auto-rotate speed

    // Load default GLB Model
    const loader = new GLTFLoader();
    if (!modelFile) {
      loader.load("/cylinder.glb", (gltf) => {
        scene.add(gltf.scene);
        setDefaultModel(gltf.scene);
        // Center the model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        // Scale the model to fit within the view
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim; // Adjust the scale factor as needed
        gltf.scene.scale.set(scale, scale, scale);
        // Center the model again after scaling
        const newBox = new THREE.Box3().setFromObject(gltf.scene);
        const newCenter = newBox.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(newCenter);

        // Add shine effect
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.material.metalness = 0.1; // Adjusted metallic ratio
            child.material.roughness = 0.2; // Adjusted roughness ratio
          }
        });
      });
    }

    // Load GLB Model from file input
    if (modelFile) {
      // Remove the default model if a new model is chosen
      if (defaultModel) {
        scene.remove(defaultModel);
        setDefaultModel(null);
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        loader.parse(event.target.result, "", (gltf) => {
          scene.add(gltf.scene);
          setModel(gltf.scene);
          // Center the model
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);
          // Scale the model to fit within the view
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.5 / maxDim; // Adjust the scale factor as needed
          gltf.scene.scale.set(scale, scale, scale);
          // Center the model again after scaling
          const newBox = new THREE.Box3().setFromObject(gltf.scene);
          const newCenter = newBox.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(newCenter);

          // Add shine effect
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.material.metalness = 0.1; // Adjusted metallic ratio
              child.material.roughness = 0.2; // Adjusted roughness ratio
            }
          });
        });
      };
      reader.readAsArrayBuffer(modelFile);
    }

    // Animation loop
    const animate = () => {
      controls.update();
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = 1; // Aspect ratio is 1 because width and height are equal
      camera.updateProjectionMatrix();
      renderer.setSize(760, 760); // 800px - 20px padding on each side
    };
    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      if (currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      window.removeEventListener("resize", handleResize);
      setDefaultModel(null);
      renderer.dispose();
    };
  }, [modelFile]);

  const handleFileChange = (event) => {
    setModelFile(event.target.files[0]);
  };

  const handleTextureChange = (event) => {
    if (model) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        new THREE.TextureLoader().load(e.target.result, (texture) => {
          texture.flipY = false; // Ensure the texture is not inverted
          texture.minFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.SRGBColorSpace; // Ensure the texture is in sRGB color space
          model.traverse((child) => {
            if (child.isMesh) {
              child.material.map = texture;
              child.material.needsUpdate = true;
            }
          });
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadImage = (format) => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;

    const originalBackground = scene.background;
    scene.background = null; // Remove background

    if (format === 'png') {
      renderer.render(scene, camera);
      const link = document.createElement('a');
      link.href = renderer.domElement.toDataURL('image/png');
      link.download = 'model.png';
      link.click();
    } else if (format === 'svg') {
      renderer.render(scene, camera);
      const canvas = renderer.domElement;
      const svg = `
        <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 830 800">
          <foreignObject width="100%" height="100%">
            <canvas xmlns="http://www.w3.org/1999/xhtml" width="${canvas.width}" height="${canvas.height}">
            
              ${canvas.toDataURL('image/png')}
            </canvas>
          </foreignObject>
        </svg>
      `;
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.href = svgUrl;
      link.download = 'model.svg';
      link.click();
    }

    scene.background = originalBackground; // Restore background
  };

  return (
    <div>
      <input type="file" accept=".glb" onChange={handleFileChange} />
      <div>
        <label>
          Texture:
          <input type="file" accept="image/*" onChange={handleTextureChange} />
        </label>
      </div>
      <button onClick={() => handleDownloadImage('png')}>Download PNG</button>
      <button onClick={() => handleDownloadImage('svg')}>Download SVG</button>
      <div
        ref={mountRef}
        style={{
          width: "800px",
          height: "800px",
          padding: "20px",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
};

export default ThreeJSeditor;
