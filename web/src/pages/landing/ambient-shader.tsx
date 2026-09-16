// Adapted from beUI Shader Background (MIT). Only ship the one variant used here.
import { MeshGradient } from "@paper-design/shaders-react"

export default function AmbientShader() {
  return <MeshGradient colors={["#ffffff", "#d4fae8", "#18e299", "#f1fbf5"]} speed={0.12} style={{ width: "100%", height: "100%" }} />
}
