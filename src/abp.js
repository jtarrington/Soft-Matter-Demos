// Imports and setup
const canvas = document.getElementById('myCanvas');
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
paper.setup(canvas);
const { Path, Point, view, Rectangle, Size } = paper;


// functions
/**
 * Places a particle anywhere in the box, randomly
 * @returns {paper.Path.Circle} Particle Path object with random position
 */
function place_particle_randomly() {
    // places a single particle
    var particle = new Path.Circle(new Point(0, 0), 1.0)
    particle.position = new Point(Lx - 100, Ly - 100)
        .multiply(Point.random())
        .add(new Point(x_box_min + 50, y_box_min + 50)); // random position 

    // color
    particle.fillColor = 'red';
    particle.strokeColor = 'black';

    // misc;
    particle.pivot = particle.position;
    particle.scaling = px_per_sigma / 2.0;
    particle.applyMatrix = false;
    return particle
}

function place_particle_at_location(center) {
    // places a single particle
    var particle = new paper.Path.Circle(center, 1.0)

    // color
    particle.fillColor = 'red';
    particle.strokeColor = 'black';

    // misc;
    particle.pivot = particle.position;
    particle.scaling = px_per_sigma / 2.0;
    particle.applyMatrix = false;

    return particle
}

function initialize_hex_lattice() {
    const margin = 50;

    // --- usable domain ---
    const x_min = x_box_min + margin;
    const x_max = x_box_max - margin;
    const y_min = y_box_min + margin;
    const y_max = y_box_max - margin;

    const width = x_max - x_min;
    const height = y_max - y_min;
    const A = width * height;

    // --- spacing from usable area ---
    const a = Math.sqrt((2 * A) / (Math.sqrt(3) * N_particles));

    const ax = a;
    const ay = Math.sqrt(3) / 2 * a;

    let i = 0;
    let row = 0;

    while (i < N_particles) {
        let y = y_min + row * ay;
        if (y > y_max) break;

        const x_offset = (row % 2 === 0) ? 0 : ax / 2;

        let col = 0;
        while (true) {
            let x = x_min + col * ax + x_offset;
            if (x > x_max) break;

            posX[i] = x;
            posY[i] = y;

            let particle = place_particle_at_location(new Point(x, y));
            particles.push(particle);

            // random orientation
            thetas[i] = 2 * Math.PI * Math.random();
            orientX[i] = Math.cos(thetas[i]);
            orientY[i] = Math.sin(thetas[i]);

            i++;
            if (i >= N_particles) return;

            col++;
        }

        row++;
    }

    if (i < N_particles) {
        console.warn(`Only placed ${i} particles out of ${N_particles}`);
    }
}

/**
 * Generates a random number centered at 0 with variance 1 with a normal distribution using the Box-Muller transform
 * @returns {number} [z0, z1] two independent normally distributed numbers
 */
function get_normal() {
    var u1 = Math.random();
    var u2 = Math.random();
    var R = Math.sqrt(-2 * Math.log(u1));
    var theta = 2 * Math.PI * u2;

    return [R * Math.cos(theta), R * Math.sin(theta)]
}

/**
 * Checks for overlap between two particles and updates them if so
 * @param {number} i integer index for particle i
 * @param {number} j integer index for particle j
 * @returns {void}
 */
function resolve_overlap(i, j) {
    // distances
    let dx = posX[i] - posX[j];
    let dy = posY[i] - posY[j];

    // minimum image
    dx -= Lx * Math.round(dx / Lx);
    dy -= Ly * Math.round(dy / Ly);

    const dist = Math.sqrt(dx * dx + dy * dy);
    const diameter = sigma * px_per_sigma
    const overlap = diameter - dist;

    if (overlap > 0 && dist > 1e-8) {
        const nx = dx / dist;
        const ny = dy / dist;
        const shift = overlap / 2.0;

        posX[i] += shift * nx;
        posY[i] += shift * ny;

        posX[j] -= shift * nx;
        posY[j] -= shift * ny;
    }

    return;
}

/**
 * Updates particle position according to overdamped Langevin equation
 * @param {number} idx integer indx for the particle to update
 * @returns {void}
 */
function update_particle_position(idx) {
    var stepX = 0;
    var stepY = 0;

    // forces
    stepX += gamma_t_dt * forceX[idx];
    stepY += gamma_t_dt * forceY[idx];

    // activity;
    stepX += gamma_t_dt * v0 * orientX[idx];
    stepY += gamma_t_dt * v0 * orientY[idx];

    // noise
    const [noiseX, noiseY] = get_normal();
    stepX += sqrt2Dtdt * noiseX;
    stepY += sqrt2Dtdt * noiseY;

    // update positions
    posX[idx] += stepX;
    posY[idx] += stepY;

    return;
}

/**
 * Updates particle orientation according to overdamped Langevin equation
 * @param {number} idx integer indx for the particle to update
 * @returns {void}
 */
function update_particle_orientation(idx) {
    let current_theta = thetas[idx];

    // noise
    let [dTheta, _] = get_normal();
    current_theta += sqrt2Drdt * dTheta;
    current_theta = current_theta % (2 * Math.PI);

    // update orientations
    thetas[idx] = current_theta;
    orientX[idx] = Math.cos(current_theta);
    orientY[idx] = Math.sin(current_theta);

    return;
}

/**
 * Updates particles with no noise
 * @param {number} idx integer indx for particle to be updated
 * @returns {void}
 */
function update_particle_no_noise(idx) {
    var stepX = 0;
    var stepY = 0;

    // forces
    stepX += gamma_t_dt * forceX[idx];
    stepY += gamma_t_dt * forceY[idx];

    // activity
    stepX += gamma_t_dt * v0 * orientX[idx];
    stepY += gamma_t_dt * v0 * orientY[idx];

    // update positions
    posX[idx] += stepX;
    posY[idx] += stepY;
}

function compute_forces() {
    // reset
    forceX.fill(0);
    forceY.fill(0);

    for (let c = 0; c < nx * ny; c++) {
        const particles_in_cell = cell_grid[c];
        const neighbors = get_neighbor_indxs(c);

        for (let i of particles_in_cell) {

            // same cell
            for (let j of particles_in_cell) {
                if (j <= i) continue;
                apply_force(i, j);
            }

            // neighbor cells
            for (let nc of neighbors) {
                if (nc <= c) continue;
                for (let j of cell_grid[nc]) {
                    apply_force(i, j);
                }
            }
        }
    }
}

// function apply_force(i, j) {
//     let dx = posX[i] - posX[j];
//     let dy = posY[i] - posY[j];

//     dx -= Lx * Math.round(dx / Lx);
//     dy -= Ly * Math.round(dy / Ly);

//     let r2 = dx * dx + dy * dy;
//     let cutoff = 1.1 * sigma * px_per_sigma;

//     if (r2 < cutoff * cutoff) {
//         let r = Math.sqrt(r2);
//         let overlap = cutoff - r;

//         // smooth repulsion (linear spring)
//         let k = 10;
//         let f = k * overlap;

//         let nx = dx / r;
//         let ny = dy / r;

//         forceX[i] += f * nx;
//         forceY[i] += f * ny;

//         forceX[j] -= f * nx;
//         forceY[j] -= f * ny;
//     }
// }

function apply_force(i, j) {
    let dx = posX[i] - posX[j];
    let dy = posY[i] - posY[j];

    // minimum image
    dx -= Lx * Math.round(dx / Lx);
    dy -= Ly * Math.round(dy / Ly);

    let r2 = dx * dx + dy * dy;
    if (r2 < 1e-12) return;

    const sigma_px = sigma * px_per_sigma;

    // WCA cutoff = 2^(1/6) * sigma
    const rc = Math.pow(2, 1 / 6) * sigma_px;
    const rc2 = rc * rc;

    if (r2 < rc2) {
        let inv_r2 = 1.0 / r2;
        let inv_r6 = inv_r2 * inv_r2 * inv_r2;

        let sigma6 = Math.pow(sigma_px, 6);
        let sigma12 = sigma6 * sigma6;

        let sr6 = sigma6 * inv_r6;
        let sr12 = sigma12 * inv_r6 * inv_r6;

        // epsilon controls stiffness
        const epsilon = 1.00;

        let force_scalar = 24 * epsilon * (2 * sr12 - sr6) * inv_r2;

        let fx = force_scalar * dx;
        let fy = force_scalar * dy;

        forceX[i] += fx;
        forceY[i] += fy;

        forceX[j] -= fx;
        forceY[j] -= fy;
    }
}

/**
 * Treating walls as aperiodic, soft repulsion
 * TODO: come back and change this to be more efficient
 */
function apply_wall_forces() {
    const epsilon = 1.0;
    const sigma_px = sigma * px_per_sigma;
    const rc = Math.pow(2, 1 / 6) * sigma_px;
    const rc2 = rc * rc;
    for (let i = 0; i < N_particles; i++) {
        let x = posX[i];
        let y = posY[i];
        let dx_max = x_box_max - x;
        let dx_min = x - x_box_min;
        let dy_max = y_box_max - y;
        let dy_min = y - y_box_min;
        if (dx_max <= rc) {
            let r2 = dx_max * dx_max;
            let inv_r2 = 1.0 / r2;
            let inv_r6 = inv_r2 * inv_r2 * inv_r2;

            let sigma6 = Math.pow(sigma_px, 6);
            let sigma12 = sigma6 * sigma6;

            let sr6 = sigma6 * inv_r6;
            let sr12 = sigma12 * inv_r6 * inv_r6;

            const epsilon = 1.00;
            let force_scalar = 24 * epsilon * (2 * sr12 - sr6) * inv_r2;

            let fx = force_scalar * dx_max;
            forceX[i] -= fx;
        }
        if (dx_min <= rc) {
            let r2 = dx_min * dx_min;
            let inv_r2 = 1.0 / r2;
            let inv_r6 = inv_r2 * inv_r2 * inv_r2;

            let sigma6 = Math.pow(sigma_px, 6);
            let sigma12 = sigma6 * sigma6;

            let sr6 = sigma6 * inv_r6;
            let sr12 = sigma12 * inv_r6 * inv_r6;

            const epsilon = 1.00;
            let force_scalar = 24 * epsilon * (2 * sr12 - sr6) * inv_r2;

            let fx = force_scalar * dx_min;
            forceX[i] += fx;
        }
        if (dy_max <= rc) {
            let r2 = dy_max * dy_max;
            let inv_r2 = 1.0 / r2;
            let inv_r6 = inv_r2 * inv_r2 * inv_r2;

            let sigma6 = Math.pow(sigma_px, 6);
            let sigma12 = sigma6 * sigma6;

            let sr6 = sigma6 * inv_r6;
            let sr12 = sigma12 * inv_r6 * inv_r6;

            const epsilon = 1.00;
            let force_scalar = 24 * epsilon * (2 * sr12 - sr6) * inv_r2;

            let fy = force_scalar * dy_max;
            forceY[i] -= fy;
        }
        if (dy_min <= rc) {
            let r2 = dy_min * dy_min;
            let inv_r2 = 1.0 / r2;
            let inv_r6 = inv_r2 * inv_r2 * inv_r2;

            let sigma6 = Math.pow(sigma_px, 6);
            let sigma12 = sigma6 * sigma6;

            let sr6 = sigma6 * inv_r6;
            let sr12 = sigma12 * inv_r6 * inv_r6;

            const epsilon = 1.00;
            let force_scalar = 24 * epsilon * (2 * sr12 - sr6) * inv_r2;

            let fy = force_scalar * dy_min;
            forceY[i] += fy;
        }
    }

    return;
}

/**
 * Initializes cell list of particles in memory
 * @returns {number} grid = array of arrays used for building the cell lists
 */
function build_cell_list_init() {
    const grid = new Array(nx * ny)
    for (let i = 0; i < grid.length; i++) {
        grid[i] = [];
    }
    return grid
}

function integrate_particle(i) {
    // orientation FIRST
    let dTheta = get_normal()[0];
    thetas[i] += sqrt2Drdt * dTheta;

    let theta = thetas[i];
    orientX[i] = Math.cos(theta);
    orientY[i] = Math.sin(theta);

    // position
    const [noiseX, noiseY] = get_normal();

    posX[i] += dt * (forceX[i] + v0 * orientX[i])
        + sqrt2Dtdt * noiseX;

    posY[i] += dt * (forceY[i] + v0 * orientY[i])
        + sqrt2Dtdt * noiseY;

    // periodic wrap 
    // posX[i] = x_box_min + ((posX[i] - x_box_min + Lx) % Lx);
    // posY[i] = y_box_min + ((posY[i] - y_box_min + Ly) % Ly);
}

/** 
 * Visualizes the cells used in the linked list
*/
function visualize_cells() {
    let x = x_box_min + cell_lx;
    while (x < x_box_max) {
        const vertical = new Path.Line(new Point(x, y_box_min), new Point(x, y_box_max));
        vertical.strokeColor = 'black';
        vertical.dashArray = [10, 4];
        vertical.strokeWidth = 2;
        x += cell_l3;

    }

    let y = y_box_min + cell_ly;
    while (y < y_box_max) {
        const horizontal = new Path.Line(new Point(x_box_min, y), new Point(x_box_max, y))
        horizontal.strokeColor = 'black';
        horizontal.dashArray = [10, 4];
        horizontal.strokeWidth = 2;
        y += cell_ly;
    }
}

/**
 * Places particles into cells in the cell list
 */
function assign_particles_to_cells() {
    // clear previous assignments
    for (let c = 0; c < nx * ny; c++) {
        cell_grid[c] = [];
    }

    // loop through particles
    console.log(cell_grid.length);
    for (let i = 0; i < N_particles; i++) {
        const cell_idx = get_cell_idx(i);
        console.log(cell_idx)
        cell_grid[cell_idx].push(i);
    }
}

/**
 * Gets the cell index of a particle
 * @param {number} idx = particle index
 * @returns {number} cell_idx = index of cell list
 */
function get_cell_idx(idx) {
    const x = posX[idx] - x_box_min;
    const y = posY[idx] - y_box_min;
    const row = Math.min(nx - 1, Math.floor(x / cell_lx));
    const col = Math.min(ny - 1, Math.floor(y / cell_ly));

    const cell_idx = row + col * nx;
    return cell_idx;
}

/**
 * Gives neighbor indexes of specific cells
 * @params {number} cell_idx = index of cell of interest
 * @returns {number} neighbor_idxs = indices of neighbor cells
 */
function get_neighbor_indxs(cell_idx) {
    const col = Math.floor(cell_idx / nx);  // y direction
    const row = cell_idx % nx;              // x direction

    const neighbors = [];

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            let newRow = row + dx;
            let newCol = col + dy;

            // OPTION 1: periodic boundaries (best for your sim)
            newRow = (newRow + nx) % nx;
            newCol = (newCol + ny) % ny;

            const neighbor_idx = newRow + newCol * nx;
            neighbors.push(neighbor_idx);
        }
    }

    return neighbors;
}

// building canvas
var margin = 20;
var x_box_min = margin;
var x_box_max = view.bounds.width - margin;
var y_box_min = margin;
var y_box_max = view.bounds.height - margin;
var Lx = x_box_max - x_box_min;
var Ly = y_box_max - y_box_min;
var bounding_box = new Path.Rectangle(
    new Rectangle(
        new Point(x_box_min, y_box_min),
        new Size({ x: x_box_max - x_box_min, y: y_box_max - y_box_min })
    ),
    20
);
bounding_box.strokeColor = 'black';
bounding_box.strokeWidth = 5;




// building cell list
let nx = 10;
let cell_lx = Lx / nx;
let ny = 10;
let cell_ly = Ly / ny;
let cell_grid = build_cell_list_init(nx, ny);
// visualize_cells();


// simulation parameters
var sigma = 1.0; // particle size
var dt = 0.01; // timestep
var px_per_sigma = 20.0 // pixels per sigma (2*radius)

// activity parameters
var Pe = 200; // Peclét number
var v0 = 24.0; // self-propulsion velocity
var Dr = 3 * v0 / (sigma * Pe); // rotational diffusion
// var Dt = Dr * (sigma ** 2) / 3.0; // translational diffusion
var Dt = 0.01

// noise parameters
var gamma_t = 1.0; // translational friction
var gamma_r = gamma_t / 3.0; // rotational friction
var T = Dt * gamma_t; // temperature
var sqrt2Dtdt = Math.sqrt(2 * Dt * dt); // prefactor for translational noise
var sqrt2Drdt = Math.sqrt(2 * Dr * dt); // prefactor for rotational noise
var gamma_t_dt = gamma_t * dt;

// placing particles
var N_particles = 1024;
// particle arrays
// positions
var posX = new Float64Array(N_particles);
var posY = new Float64Array(N_particles);
// orientations
var thetas = new Float64Array(N_particles);
var orientX = new Float64Array(N_particles);
var orientY = new Float64Array(N_particles);
// forces
var forceX = new Float64Array(N_particles);
var forceY = new Float64Array(N_particles);
// types
var types = new Uint8Array(N_particles);
var particles = []; // list of all particles    
initialize_hex_lattice();
// for (var i = 0; i < N_particles; i++) {
//     // place particles
//     var particle = place_particle_randomly();
//     posX[i] = particle.position.x;
//     posY[i] = particle.position.y;

//     // assign random orientations
//     thetas[i] = 2 * Math.PI * Math.random();
//     orientX[i] = Math.cos(thetas[i]);
//     orientY[i] = Math.sin(thetas[i]);

//     // add to list
//     particles.push(particle);
// }

// updating positions
const target = 25;
const neighbor_to_target = get_neighbor_indxs(target);
function onFrame(event) {
    assign_particles_to_cells();
    compute_forces();
    apply_wall_forces();

    for (let i = 0; i < N_particles; i++) {
        // forces

        // update positions
        // update_particle_position(i);
        // update_particle_orientation(i);
        integrate_particle(i);

        // wrap positions
        // if (posX[i] < x_box_min) { posX[i] = x_box_max - (x_box_min - posX[i]) }
        // if (posX[i] > x_box_max) { posX[i] = x_box_min + (posX[i] - x_box_max) }
        // if (posY[i] < y_box_min) { posY[i] = y_box_max - (y_box_min - posY[i]) }
        // if (posY[i] > y_box_max) { posY[i] = y_box_min + (posY[i] - y_box_max) }

        // update graphics
        particles[i].position = new Point(posX[i], posY[i]);
    }



}

view.onFrame = onFrame;
