import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const ThreeJSeditor = () => {
  const mountRef = useRef(null);
  const [modelFile, setModelFile] = useState(null);
  const [model, setModel] = useState(null);

  useEffect(() => {
    const currentMount = mountRef.current;
 
    let scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);

    const camera = new THREE.PerspectiveCamera(55, 1, 1, 1000);
    camera.position.set(0, 0, 2); // Adjust the camera position

    // Renderer setup
    let renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(760, 760); 
    currentMount.appendChild(renderer.domElement); 

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    // Add lights
    const ambientLight1 = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight1);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-10, 0, 0);
    scene.add(directionalLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(8, 0, 5.5);
    scene.add(directionalLight1);

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Load GLB Model
    if (modelFile) { 
      const loader = new GLTFLoader();
      const reader = new FileReader();
      reader.onload = (event) => {
        loader.parse(event.target.result, "", (gltf) => { 
          scene.add(gltf.scene);
          setModel(gltf.scene); // Save the loaded model to state
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
        new THREE.TextureLoader().load(
          e.target.result,
          (texture) => {
            texture.flipY = false; // Ensure the texture is not inverted
            texture.minFilter = THREE.LinearFilter;
            texture.colorSpace = THREE.SRGBColorSpace; // Ensure the texture is in sRGB color space
            model.traverse((child) => {
              if (child.isMesh) {
                child.material.map = texture;
                child.material.needsUpdate = true;
              }
            });
          }
        );
      };
      reader.readAsDataURL(file);
    }
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
