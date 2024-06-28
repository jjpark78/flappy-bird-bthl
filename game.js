//board
let board;
let boardWidth = window.innerWidth;
let boardHeight = window.innerHeight;
let context;

//bird
let birdSpriteFilename = "./assets/player.svg";
let birdHeight = 100;
let birdWidth = birdHeight * 0.86; //width/height ratio = 408/228 = 17/12
let birdX = boardWidth / 8;
let birdY = boardHeight / 2;
let birdImg;

let bird = {
	x: birdX,
	y: birdY,
	width: birdWidth,
	height: birdHeight,
};

//pipes
let pipeArray = [];
let pipeWidth = 120; //width/height ratio = 384/3072 = 1/8
let pipeHeight = 512 + 100;
let pipeX = boardWidth;
let pipeY = 0;

let topPipeImg;
let bottomPipeImg;

//physics
let velocityX = -15; //pipes moving left speed
let velocityY = 0; //bird jump speed
let gravity = 1.0;

let gameOver = false;
let gameEndOK = false;
let score = 0;

const GOAL_SCORE = 6;
let placePipeInterval = 1500;
const GAME_TOTAL_PROGRESS = 700;
let currentProgress = 0;

let progressBarImg;
let progressBarIconImg;
// define utils funtions
// async timeout
function setTimeoutAsync(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// promise with not blocked execution
function runPromiseWithFunctorLoop(functor, needToStop, removeEventHandler) {
	return new Promise((resolve, reject) => {
		async function loop() {
			for (;;) {
				try {
					await functor();
					const state = needToStop();
					switch (state) {
						case "SUCCEED":
							removeEventHandler();
							return resolve(true);
						case "FAILED":
							removeEventHandler();
							return resolve(false);
						case "ONPLAYING":
						default:
							break;
					}
				} catch (err) {
					reject();
				}
				setTimeout(loop, 0);
			}
		}
		loop();
	});
}

// promise with not blocked but game main loop
function runPromiseWithFunctorGameLoop(
	functor,
	needToStop,
	removeEventHandler,
) {
	return new Promise((resolve, reject) => {
		async function loop() {
			requestAnimationFrame(functor);
			const state = needToStop();
			switch (state) {
				case "SUCCEED":
					removeEventHandler();
					return resolve(true);
				case "FAILED":
					removeEventHandler();
					return resolve(false);
				case "ONPLAYING":
				default:
			}
			setTimeout(loop, 25);
		}
		loop();
	});
}

async function playCongrat() {
	return new Promise((resolve, reject) => {
		const bgmPlayer = document.getElementById("bgmPlayer");
		bgmPlayer.pause();
		const successPlayer = document.getElementById("successPlayer");
		successPlayer.volume = 0.3;
		successPlayer.play();

		const canvas = document.getElementById("board");
		const ctx = canvas.getContext("2d");
		const message = document.getElementById("message");
		message.innerText = LANGUAGE_DATA.CONGRAT;
		let animationId;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		const confettiCount = 300;
		const confetti = [];
		const colors = [
			"#ff0a54",
			"#ff477e",
			"#ff7096",
			"#ff85a1",
			"#fbb1bd",
			"#f9bec7",
		];
		class ConfettiPiece {
			constructor() {
				this.x = Math.random() * canvas.width;
				this.y = Math.random() * canvas.height - canvas.height;
				this.size = Math.random() * 10 + 5;
				this.speed = Math.random() * 5 + 2;
				this.color = colors[Math.floor(Math.random() * colors.length)];
				this.opacity = Math.random();
				this.rotate = Math.random() * 360;
				this.rotateSpeed = Math.random() * 5;
			}

			update() {
				this.y += this.speed;
				if (this.y > canvas.height) {
					this.y = Math.random() * canvas.height - canvas.height;
					this.x = Math.random() * canvas.width;
					this.opacity = Math.random();
					this.speed = Math.random() * 5 + 2;
					this.size = Math.random() * 10 + 5;
					this.rotate = Math.random() * 360;
					this.rotateSpeed = Math.random() * 5;
				}
				this.rotate += this.rotateSpeed;
			}

			draw() {
				ctx.save();
				ctx.globalAlpha = this.opacity;
				ctx.fillStyle = this.color;
				ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
				ctx.rotate((Math.PI / 180) * this.rotate);
				ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
				ctx.restore();
			}
		}

		for (let i = 0; i < confettiCount; i++) {
			confetti.push(new ConfettiPiece());
		}

		function animate() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			confetti.forEach((piece) => {
				piece.update();
				piece.draw();
			});
			animationId = requestAnimationFrame(animate);
		}

		animate();

		setTimeout(() => {
			message.style.opacity = 0;
			cancelAnimationFrame(animationId);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			resolve();
		}, 6000);

		setTimeout(() => {
			message.style.opacity = 1;
		}, 50); // Delay before fading in
	});
}

window.onload = async function () {
	//await playCongrat();
	try {
		await navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
			const bgmPlayer = document.getElementById("bgmPlayer");
			bgmPlayer.volume = 0.1;
			bgmPlayer.play();
		});
		await displayScenes(introScenes, {
			fadeIn: true,
			fadeOut: true,
			fadeInDelay: 2,
			fadeOutDelay: 2,
		});
		await makeBackgroundImage();
		await runPromiseWithFunctorLoop(
			displayCountDown,
			() => {
				return "SUCCEED";
			},
			() => {},
		);
		await initGame();
		const result = await runPromiseWithFunctorGameLoop(
			gameLoop,
			() => {
				if (gameOver) return "FAILED";
				if (gameEndOK) return "SUCCEED";
				return "ONPLAYING";
			},
			() => {
				document.removeEventListener("keydown", moveBird);
			},
		);
		if (result) {
			await playCongrat();
			playApplause();
			document.body.style.backgroundImage = "none";
			document.body.style.backgroundColor = "black";
			await displayScenes(outroScenes, {
				fadeIn: true,
				fadeOut: true,
				fadeInDelay: 20,
				fadeOutDelay: 2,
			});
		} else {
			await playFailed();
		}
		await displayReplay();
	} catch (err) {
		console.error(err);
	}
};

function playApplause() {
	const applPlayer = document.getElementById("applausePlayer");
	applPlayer.volume = 0.7;
	applPlayer.play();
}

async function playFailed() {
	return new Promise((resolve, reject) => {
		const bgmPlayer = document.getElementById("bgmPlayer");
		bgmPlayer.pause();
		const failPlayer = document.getElementById("failPlayer");
		failPlayer.volume = 0.3;
		failPlayer.play();
		setTimeout(resolve, 4000);
	});
}

async function displayReplay() {
	return new Promise((resolve, reject) => {
		document.body.style.backgroundImage = "none";
		document.body.style.backgroundColor = "black";
		const b = document.getElementById("board");
		const c = b.getContext("2d"); //used for drawing on the board
		document.addEventListener("keydown", checkKey);
		function checkKey(e) {
			if (e.code === "KeyY") {
				location.reload();
				resolve();
			}
		}
		function drawReplay() {
			c.clearRect(0, 0, window.innerWidth, window.innerHeight);
			b.height = window.innerHeight;
			b.width = window.innerWidth;
			c.font = "100px Arial";
			c.fillStyle = "yellow";
			c.textAling = "center";
			const readyText = LANGUAGE_DATA.AGAIN;
			const readyTextWidth = c.measureText(readyText).width;
			c.fillText(
				readyText,
				board.width / 2 - readyTextWidth / 2,
				board.height / 2,
			);
			requestAnimationFrame(drawReplay);
		}
		drawReplay();
	});
}

async function makeBackgroundImage() {
	document.body.style.backgroundImage = "url('./assets/background.svg')";
}

let currentSceneIndex = 0;
let oldIntroSceneIndex = 0;

const introScenes = [
	{
		name: `./assets/${LANGUAGE_DATA.CODE.toLowerCase()}/intro-01.svg`,
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	},
	{
		name: `./assets/${LANGUAGE_DATA.CODE.toLowerCase()}/intro-02.svg`,
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	},
	{
		name: `./assets/${LANGUAGE_DATA.CODE.toLowerCase()}/intro-03.svg`,
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	},
	{
		name: `./assets/${LANGUAGE_DATA.CODE.toLowerCase()}/intro-04.svg`,
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	},
];
const outroScenes = [
	{
		name: `./assets/${LANGUAGE_DATA.CODE.toLowerCase()}/outro-01.jpg`,
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	},
];

async function displayScenes(
	scenes,
	{ fadeIn, fadeOut, fadeInDelay, fadeOutDelay },
) {
	console.log("in displayScenes");
	let first = true;
	for (const imageConfig of scenes) {
		const sceneImg = new Image();
		board = document.getElementById("board");
		board.height = imageConfig.height;
		board.width = imageConfig.width;
		context = board.getContext("2d"); //used for drawing on the board
		if (first && fadeIn) {
			first = false;
			sceneImg.src = imageConfig.name;
			sceneImg.onload = async function () {
				await fadeInImage(board, sceneImg, fadeInDelay);
			};
		} else {
			sceneImg.src = imageConfig.name;
			sceneImg.onload = function () {
				context.drawImage(
					sceneImg,
					imageConfig.x,
					imageConfig.y,
					imageConfig.width,
					imageConfig.height,
				);
			};
		}
		await waitForKeyPress();
		if (fadeOut) await fadeOutImage(board, sceneImg, fadeOutDelay);
	}

	function waitForKeyPress() {
		return new Promise((resolve) => {
			function onKeyPress(event) {
				document.removeEventListener("keydown", onKeyPress);
				resolve(event);
			}

			document.addEventListener("keydown", onKeyPress);
		});
	}

	function fadeInImage(canvas, image, delay) {
		return new Promise((resolve, reject) => {
			var opacity = 0.0;
			var fadeInInterval = setInterval(function () {
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.globalAlpha = opacity;
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				opacity += 0.02;
				if (opacity >= 1.0) {
					opacity = 1.0;
					context.drawImage(image, 0, 0, canvas.width, canvas.height);
					clearInterval(fadeInInterval);
					resolve();
				}
			}, delay); // Adjust the interval time (50ms) for different fade-out speeds
		});
	}

	function fadeOutImage(canvas, image, delay) {
		return new Promise((resolve, reject) => {
			var opacity = 1.0;
			var fadeOutInterval = setInterval(function () {
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.globalAlpha = opacity;
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				opacity -= 0.02;
				if (opacity <= 0) {
					clearInterval(fadeOutInterval);
					context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas completely
					resolve();
				}
			}, delay); // Adjust the interval time (50ms) for different fade-out speeds
		});
	}
}

async function displayCountDown() {
	board = document.getElementById("board");
	board.height = boardHeight;
	board.width = boardWidth;
	context = board.getContext("2d"); //used for drawing on the board
	for (let count = 5; count >= 0; count--) {
		birdImg = new Image();
		birdImg.src = birdSpriteFilename;
		birdImg.onload = function () {
			context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
		};
		context.clearRect(0, 0, board.width, board.height);
		context.font = "100px Arial";
		context.fillStyle = "black";
		context.textAling = "center";
		switch (count) {
			case 5:
			case 4:
				const readyText = LANGUAGE_DATA.READY;
				const readyTextWidth = context.measureText(readyText).width;
				context.fillText(
					readyText,
					board.width / 2 - readyTextWidth / 2,
					board.height / 2,
				);
				break;
			case 3:
				context.fillText(
					LANGUAGE_DATA.THREE,
					board.width / 2,
					board.height / 2,
				);
				break;
			case 2:
				context.fillText(LANGUAGE_DATA.TWO, board.width / 2, board.height / 2);
				break;
			case 1:
				context.fillText(LANGUAGE_DATA.ONE, board.width / 2, board.height / 2);
				break;
			case 0:
				const goText = LANGUAGE_DATA.START;
				const goTextWidth = context.measureText(goText).width;
				context.fillText(
					goText,
					board.width / 2 - goTextWidth / 2,
					board.height / 2,
				);
				break;
			default:
				break;
		}
		await setTimeoutAsync(1000);
	}
}

async function initGame() {
	board = document.getElementById("board");
	board.height = boardHeight;
	board.width = boardWidth;
	context = board.getContext("2d"); //used for drawing on the board

	birdImg = new Image();
	birdImg.src = birdSpriteFilename;
	birdImg.onload = function () {
		context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
	};

	topPipeImg = new Image();
	topPipeImg.src = "./assets/obstacle.svg";

	bottomPipeImg = new Image();
	bottomPipeImg.src = topPipeImg.src;
	document.addEventListener("keydown", moveBird);
	currentProgress = 0;

	progressBarImg = new Image();
	progressBarImg.src = "./assets/progressbar.svg";

	progressBarIconImg = new Image();
	progressBarIconImg.src = "./assets/progressbar_icon.svg";

	setInterval(placePipes, placePipeInterval); //every 1.5 seconds
	requestAnimationFrame(gameLoop);
}

function moveBird(e) {
	const jumpPlayer = document.getElementById("jumpPlayer");
	if (e.code == "Space" || e.code == "ArrowUp" || e.code == "KeyX") {
		velocityY = -6;
		jumpPlayer.volume = 0.1;
		jumpPlayer.play();
	}
}

function placePipes() {
	let pipeBottomFlag = Math.random() > 0.5 ? true : false;
	let pipeTopFlag = Math.random() > 0.5 ? true : false;
	if (!pipeBottomFlag && !pipeTopFlag) {
		pipeTopFlag = true;
		pipeBottomFlag = true;
	}
	//if (pipeBottomFlag && pipeTopFlag) {
	//	let centerPipe = {
	//		img: topPipeImg,
	//		x: pipeX,
	//		y: window.innerHeight / 2,
	//		width: pipeWidth,
	//		height: 300,
	//		passed: false,
	//	};
	//	pipeArray.push(centerPipe);
	//} else {
	let randomPipeY =
		pipeY -
		pipeHeight / 7 -
		Math.min(Math.random() * Math.random(), 0.5) * (pipeHeight / 2);
	let openingSpace = board.height / 5;
	let topPipe = {
		img: topPipeImg,
		x: pipeX,
		y: randomPipeY,
		width: pipeWidth,
		height: pipeHeight,
		passed: false,
	};
	if (pipeTopFlag) pipeArray.push(topPipe);
	let bottomPipe = {
		img: bottomPipeImg,
		x: pipeX,
		y: randomPipeY + pipeHeight + openingSpace - 20,
		width: pipeWidth,
		height: pipeHeight,
		passed: false,
	};
	if (pipeBottomFlag) pipeArray.push(bottomPipe);
	//}
}

function gameLoop() {
	context.clearRect(0, 0, board.width, board.height);

	velocityY += gravity;
	bird.y = Math.max(bird.y + velocityY, 0); //apply gravity to current bird.y, limit the bird.y to top of the canvas
	context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
	if (bird.y > board.height) {
		gameOver = true;
	}

	for (let i = 0; i < pipeArray.length; i++) {
		let pipe = pipeArray[i];
		pipe.x += velocityX;
		context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);

		if (!pipe.passed && bird.x > pipe.x + pipe.width) {
			score += 0.5; //0.5 because there are 2 pipes! so 0.5*2 = 1, 1 for each set of pipes
			pipe.passed = true;
		}

		if (detectCollision(bird, pipe)) {
			gameOver = true;
		}
	}

	while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) {
		pipeArray.shift(); //removes first element from the array
	}
	currentProgress++;

	if (currentProgress >= GAME_TOTAL_PROGRESS) {
		gameEndOK = true;
	}

	drawProgressBar(context, currentProgress / GAME_TOTAL_PROGRESS);
	function detectCollision(a, b) {
		return (
			a.x < b.x + b.width && //a's top left corner doesn't reach b's top right corner
			a.x + a.width > b.x && //a's top right corner passes b's top left corner
			a.y < b.y + b.height && //a's top left corner doesn't reach b's bottom left corner
			a.y + a.height > b.y
		); //a's bottom left corner passes b's top left corner
	}
}

const progressBar = {
	x: 20,
	y: window.innerHeight - 50 - 15,
	width: window.innerWidth - 40,
	height: 50,
	value: 0.0, // initial progress value (0 to 1)
	indicatorSize: 20,
	indicatorOffset: 0, // offset for the arrow indicator
};

function drawProgressBar(context, percent) {
	context.fillStyle = "gray";
	context.fillRect(
		0,
		progressBar.y - 10,
		window.innerWidth,
		Math.abs(progressBar.height - window.innerHeight),
	);

	context.drawImage(
		progressBarImg,
		progressBar.x,
		progressBar.y,
		progressBar.width,
		progressBar.height,
	);

	if (percent > 1) {
		percent = 1;
	}
	const maxInnerWidth = progressBar.width - 12 - 15;
	const percentWidth = percent * maxInnerWidth;
	context.fillStyle = "green";
	context.fillRect(
		progressBar.x + 12,
		progressBar.y + 8,
		percentWidth,
		progressBar.height - 16,
	);

	context.drawImage(
		progressBarIconImg,
		percentWidth,
		progressBar.y - 16,
		80,
		80,
	);
}
