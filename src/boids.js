// const { Path } = require("paper/dist/paper-core");

// functions
function buildBoid() {
    // builds boids to be facing to the right and randomly placed in the box
    var myPath = new Path();
    myPath.add(new Point(-2, -1));
    myPath.add(new Point(-2, 1));
    myPath.add(new Point(1, 0));
    myPath.closed = true;

    myPath.fillColor = 'black';
    myPath.strokeColor = "#ff671f";
    myPath.strokeWidth = 3;

    // move to random point in box
    myPath.position = new Point(xBounding, yBounding) * Point.random() + new Point(xBoxMin, yBoxMin);
    myPath.pivot = myPath.position;
    myPath.scaling = 10;
    myPath.applyMatrix = false; // necessary to change rotation

    return myPath;
}

// building canvas
var margin = 50;
var xBoxMin = margin;
var xBoxMax = view.bounds.width - margin;
var yBoxMin = margin;
var yBoxMax = view.bounds.height - margin;
var xBounding = xBoxMax - xBoxMin;
var yBounding = yBoxMax - yBoxMin;
// var boundingBox = new Path.Rectangle(new Rectangle(new Point(xBoxMin, yBoxMin), new Size({ x: xBoxMax - xBoxMin, y: yBoxMax - yBoxMin })), 20);
// boundingBox.strokeColor = 'black';
// boundingBox.strokeWidth = 5;

// placing boids
var boids = [];
var velocities = [];
var nBoids = 170;
for (var i = 0; i < nBoids; i++) {
    var boid = buildBoid();
    boid.rotate(Math.random());
    // if (i > 64) { boid.fillColor = 'blue' }// DEBUG: recoloring
    boids.push(boid);

    var boidVelocity = new Point(2, 2) * Point.random() - new Point(1, 1);
    boidVelocity.length = 3;
    velocities.push(boidVelocity);
}

// simulation parameters
var protectedRange = 20;
var visualRange = 50;
var avoidFactor = 0.05;
var matchingFactor = 0.05;
var centeringFactor = 0.00005;
var minSpeed = 3;
var maxSpeed = 9;

// mouse avoidance parameters
var mouseAvoidanceRadius = 200;
var mouseAvoidanceFactor = 1.0;
var mousePoint = new Point(0, 0);
// var mouseAvoidancePath = new Path.Circle(mousePoint, mouseAvoidanceRadius / 4);
var mouseAvoidanceTriangle = buildBoid();
// mouseAvoidancePath.fillColor = 'red';
// mouseAvoidancePath.strokeColor = 'black';
mouseAvoidanceTriangle.fillColor = 'red';
mouseAvoidanceTriangle.strokeColor = 'black';
mouseAvoidanceTriangle.scaling = mouseAvoidanceRadius / 90;


// simulation parameters from GUI
// separation
var avoidFactorSlider = document.getElementById("separationSlider");
// var avoidFactorOutput = document.getElementById("separationOutput");
// avoidFactorOutput.innerHTML = avoidFactorSlider.value;
avoidFactorSlider.oninput = function () {
    avoidFactor = Number(this.value);
    // avoidFactorOutput.innerHTML = this.value;
}

// alignment
var matchingFactorSlider = document.getElementById("alignmentSlider");
// var matchingFactorOutput = document.getElementById("alignmentOutput");
// matchingFactorOutput.innerHTML = matchingFactorSlider.value;
matchingFactorSlider.oninput = function () {
    matchingFactor = Number(this.value);
    // matchingFactorOutput.innerHTML = this.value;
}


// cohesion
var centeringFactorSlider = document.getElementById("cohesionSlider");
// var centeringFactorOutput = document.getElementById("cohesionOutput");
// centeringFactorOutput.innerHTML = centeringFactorSlider.value;
centeringFactorSlider.oninput = function () {
    centeringFactor = Number(this.value);
    // centeringFactorOutput.innerHTML = this.value;
}

// DEBUG - speed
var minSpeedSlider = document.getElementById("minSpeedSlider");
var minSpeedOutput = document.getElementById("minSpeedOutput");
minSpeedOutput.innerHTML = minSpeedSlider.value;
minSpeedSlider.oninput = function () {
    minSpeed = Number(this.value);
    minSpeedOutput.innerHTML = this.value;
}
var maxSpeedSlider = document.getElementById("maxSpeedSlider");
var maxSpeedOutput = document.getElementById("maxSpeedOutput");
maxSpeedOutput.innerHTML = maxSpeedSlider.value;
maxSpeedSlider.oninput = function () {
    maxSpeed = Number(this.value);
    maxSpeedOutput.innerHTML = this.value;
}

// DEBUG - visualizing the ranges
var visualRangeCircle = new Path.Circle(new Point(0, 0), visualRange)
visualRangeCircle.strokeColor = 'black';
visualRangeCircle.strokeWidth = 2;
visualRangeCircle.visible = false;
var protectedRangeCircle = new Path.Circle(new Point(0, 0), protectedRange)
protectedRangeCircle.strokeColor = 'red';
protectedRangeCircle.strokeWidth = 1;
protectedRangeCircle.dashArray = [10, 4];
protectedRangeCircle.visible = false;
var visualGroup = new Group([visualRangeCircle, protectedRangeCircle])
visualGroup.position = boids[0].position;
var visualRadii = document.getElementById("radiiBoxChecked");
visualRadii.addEventListener('change', function () {
    protectedRangeCircle.visible = this.checked;
    visualRangeCircle.visible = this.checked;
});
// DEBUG - protected range
var protectedRangeSlider = document.getElementById("protectedRangeSlider");
var protectedRangeOutput = document.getElementById("protectedRangeOutput");
protectedRangeOutput.innerHTML = protectedRange;
protectedRangeOutput.innerHTML = protectedRangeSlider.value;
protectedRangeSlider.oninput = function () {
    protectedRange = Number(this.value);
    protectedRangeOutput.innerHTML = this.value;

    // re-drawing
    // const newRadius = Number(this.value);
    var newRadius = Number(this.value);
    protectedRangeCircle.remove();
    protectedRangeCircle = new Path.Circle(boids[0].position, newRadius);
    visualGroup.addChild(protectedRangeCircle);

    // const currentRadius = protectedRangeCircle.bounds.width / 2;
    // const currentRadius = protectedRangeCircle.bounds.width / 2;
    // const scaleFactor = protectedRange / currentRadius;
    // protectedRangeCircle.scale(scaleFactor);
}
// DEBUG - visual range
var visualRangeSlider = document.getElementById("visualRangeSlider");
var visualRangeOutput = document.getElementById("visualRangeOutput");
visualRangeOutput.innerHTML = visualRangeSlider.value;
visualRangeSlider.oninput = function () {
    visualRange = Number(this.value);
    visualRangeOutput.innerHTML = this.value;

    // re-drawing
    // const currentRadius = visualRangeCircle.bounds.width / 2;
    // const scaleFactor = visualRange / currentRadius;
    // visualRangeCircle.scale(scaleFactor);
}

// turning parameters
var turnMargins = 250;
var turnFactor = 0.2;
var xMinMargin = xBoxMin + turnMargins;
var xMaxMargin = xBoxMax - turnMargins;
var yMinMargin = yBoxMin + turnMargins;
var yMaxMargin = yBoxMax - turnMargins;

// DEBUG - visualize turning radius
var turningBox = new Path.Rectangle(new Rectangle(new Point(xMinMargin, yMinMargin), new Size({ x: xMaxMargin - xMinMargin, y: yMaxMargin - yMinMargin })), 20);
turningBox.strokeColor = 'red';
turningBox.strokeWidth = 2.5;
turningBox.dashArray = [10, 4];
turningBox.visible = false;
var checkbox = document.getElementById("turningBoxChecked");
checkbox.addEventListener('change', function () {
    turningBox.visible = this.checked;
    // turningBox.
});

// DEBUG - turning radius
var turnMarginsSlider = document.getElementById("turningMarginSlider");
var turningMarginOutput = document.getElementById("turningMarginOutput");
turningMarginOutput.innerHTML = turnMarginsSlider.value;
turnMarginsSlider.oninput = function () {
    turnMargins = Number(this.value);
    // turnMargins = 50;
    turningMarginOutput.innerHTML = this.value;

    // update the margins and box
    xMinMargin = xBoxMin + turnMargins;
    xMaxMargin = xBoxMax - turnMargins;
    yMinMargin = yBoxMin + turnMargins;
    yMaxMargin = yBoxMax - turnMargins;


    // redraw box
    turningBox.remove();
    turningBox = new Path.Rectangle(
        new Rectangle(
            new Point(xMinMargin, yMinMargin),
            new Size(xMaxMargin - xMinMargin, yMaxMargin - yMinMargin)
        ),
        20
    );
    turningBox.strokeColor = 'red';
    turningBox.strokeWidth = 2.5;
    turningBox.dashArray = [10, 4];
    turningBox.visible = checkbox.checked;
}
var turningFactorSlider = document.getElementById("turningFactorSlider");
var turningFactorOutput = document.getElementById("turningFactorOutput");
turningFactorOutput.innerHTML = turningFactorSlider.value;
turningFactorSlider.oninput = function () {
    turnFactor = Number(this.value);
    turningFactorOutput.innerHTML = this.value;
}

// position updates
var targetAngle = 0.0;
var smoothAngle = 0.0;
function onMouseMove(event) {
    var oldPosition = mouseAvoidanceTriangle.position;
    mousePoint = event.point;

    var delta = mousePoint - oldPosition;
    if (delta.length > 5) {
        targetAngle = delta.angle;
    }
    mouseAvoidanceTriangle.position = mousePoint;
}

function onFrame(event) {
    for (var i = 0; i < boids.length; i++) {
        var bi = boids[i];
        var vi = velocities[i];

        // for alignment
        var xvel_avg = 0;
        var yvel_avg = 0;
        var neighboring_boids = 0;

        // for cohesion
        var xpos_avg = 0;
        var ypos_avg = 0;

        // looping thru other boids
        var close = new Point(0, 0);
        for (var j = 0; j < boids.length; j++) {
            if (j != i) {
                var bj = boids[j];
                var vj = velocities[j];
                var distance = (bj.position - bi.position).length;
                // separation
                if (distance < protectedRange) {
                    close.x += bi.position.x - bj.position.x;
                    close.y += bi.position.y - bj.position.y;
                }
                // alignment and cohesion
                else if (distance < visualRange) {
                    xvel_avg += vj.x;
                    yvel_avg += vj.y;
                    xpos_avg += bj.position.x;
                    ypos_avg += bj.position.y;
                    neighboring_boids += 1;
                }
            }
        }
        // alignment and cohesion adjustment
        if (neighboring_boids > 0) {
            xvel_avg = xvel_avg / neighboring_boids;
            yvel_avg = yvel_avg / neighboring_boids;
            xpos_avg = xpos_avg / neighboring_boids;
            ypos_avg = ypos_avg / neighboring_boids;

            // alignment
            vi.x += (xvel_avg - vi.x) * matchingFactor;
            vi.y += (yvel_avg - vi.y) * matchingFactor;

            // cohesion
            vi.x += (xpos_avg - bi.position.x) * centeringFactor;
            vi.y += (ypos_avg - bi.position.y) * centeringFactor;

        }

        // separation adjustment
        vi.x += close.x * avoidFactor;
        vi.y += close.y * avoidFactor;

        // constrain velocities
        if (vi.length > maxSpeed) { vi.length = maxSpeed }
        if (vi.length < minSpeed) { vi.length = minSpeed }

        // mouse avoidance
        var distanceToMouse = (mousePoint - bi.position).length;
        if (distanceToMouse < mouseAvoidanceRadius) {
            var awayFromMouse = bi.position - mousePoint;
            var avoidanceStrength = (mouseAvoidanceRadius - distanceToMouse) / mouseAvoidanceRadius;

            awayFromMouse = awayFromMouse.normalize();
            vi.x += awayFromMouse.x * avoidanceStrength * mouseAvoidanceFactor;
            vi.y += awayFromMouse.y * avoidanceStrength * mouseAvoidanceFactor;
        }

        // update position
        bi.position.x += vi.x;
        bi.position.y += vi.y;
        bi.rotation = vi.angle;

        // screen edges
        if (bi.position.x < xMinMargin) { vi.x += turnFactor }
        if (bi.position.x > xMaxMargin) { vi.x -= turnFactor }
        if (bi.position.y < yMinMargin) { vi.y += turnFactor }
        if (bi.position.y > yMaxMargin) { vi.y -= turnFactor }

        // smoothing predator turns
        var diff = targetAngle - smoothAngle;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        smoothAngle += diff * 0.45;
        mouseAvoidanceTriangle.rotation = smoothAngle;
    }
}

function onResize() {
    // var margin = 20;
    return;
    // // bbox = {
    //     xl: margin,
    //     xr: view.bounds.width - margin,
    //     yt: margin,
    //     yb: view.bounds.height - margin
    // };
    // // for (var i = 0, l = sites.length; i < l; i++) {
    // //     sites[i] = sites[i] * view.size / oldSize;
    // // }
    // // oldSize = view.size;
    // // // renderDiagram();
}
