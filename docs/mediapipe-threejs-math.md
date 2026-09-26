# Mathematical Formulation: Landmark to 3D Space Projection

## 1. Coordinate System Mapping

MediaPipe Tasks Vision outputs normalized coordinates:
$$x_{mp} \in [0, 1], \quad y_{mp} \in [0, 1], \quad z_{mp} \approx \text{depth relative to landmark origin}$$

Three.js operates in Normalized Device Coordinates (NDC) in $[-1, 1]^3$:

$$X_{ndc} = 2 \cdot x_{mp} - 1$$
$$Y_{ndc} = -(2 \cdot y_{mp} - 1)$$
$$Z_{ndc} = z_{mp}$$

The negative sign in $Y_{ndc}$ accounts for the inverted Y-axis between WebGL screen space and typical image raster arrays.

---

## 2. Perspective Unprojection & Camera Intrinsics

Given pinhole camera focal length $f_x, f_y$ and principal point $(c_x, c_y)$, the camera intrinsic matrix $K$ is defined as:

$$K = \begin{bmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{bmatrix}$$

For a Three.js `PerspectiveCamera` with vertical Field-of-View $\theta_{fov}$ and aspect ratio $A = \frac{W}{H}$:

$$\tan\left(\frac{\theta_{fov}}{2}\right) = \frac{H / 2}{f_y}$$

The world-space position $P_w = (X_w, Y_w, Z_w)^T$ at estimated face depth $Z_{depth}$ is computed via:

$$X_w = X_{ndc} \cdot Z_{depth} \cdot \tan\left(\frac{\theta_{fov}}{2}\right) \cdot A$$
$$Y_w = Y_{ndc} \cdot Z_{depth} \cdot \tan\left(\frac{\theta_{fov}}{2}\right)$$
$$Z_w = -Z_{depth}$$

---

## 3. Metric Scaling via Interpupillary Distance (IPD)

To render physical objects (e.g. glasses frames of width $140\text{ mm}$) to exact scale, the metric scale factor $S_{metric}$ is computed from human facial anatomical priors:

$$S_{metric} = \frac{\text{IPD}_{physical}}{\| P_{left\_pupil} - P_{right\_pupil} \|_2}$$

Where standard adult $\text{IPD}_{physical} \approx 63.0\text{ mm}$.

---

## 4. Jitter Reduction: Exponential Moving Average (EMA) & 1€ Filter

Raw neural network landmark detections exhibit high-frequency sensor noise. Let $x_t$ be the raw landmark coordinate at frame $t$, and $\hat{x}_t$ be the smoothed estimate:

$$\hat{x}_t = \alpha \cdot x_t + (1 - \alpha) \cdot \hat{x}_{t-1}$$

Where $\alpha \in (0, 1]$ is dynamically tuned:
- Low velocity ($\Delta x \to 0$): $\alpha \to \alpha_{min}$ to prevent tremor when stationary.
- High velocity ($\Delta x \gg 0$): $\alpha \to 1.0$ to eliminate tracking lag during rapid head turns.
