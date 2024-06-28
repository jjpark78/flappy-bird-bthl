//board
let board;
let boardWidth = window.innerWidth;
let boardHeight = 800;
let context;

//bird
let birdSpriteFilename = "./flappybird.svg";
let birdHeight = 60;
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
let gravity = 0.6;

let gameOver = false;
let gameEndOK = false;
let score = 0;

const GOAL_SCORE = 8;
const GAME_TOTAL_PROGRESS = 200;
let currentProgress = 0;

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

window.onload = async function () {
	navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
		const bgmPlayer = document.getElementById("bgmPlayer");
		bgmPlayer.volume = 0.1;
		bgmPlayer.play();
	});
	//const displayIntroScene = displayScenes(introScenes);
	//const displayOutroScene = displayScenes(outroScenes);
	//console.log(displayScenes(introScenes));
	//이렇게 하면 간단하게 await를 써서 블럭되지 않으면서 화면 전환을 함수별로 만들어 쓸수 있다.
	//play game scene first
	//await runPromiseWithFunctorLoop(
	//	displayIntroScene,
	//	() => {
	//		//return "SUCCEED";
	//		if (currentSceneIndex > TOTAL_SCENE_COUNT) {
	//			//키보드 이벤트 핸들러 해제
	//			return "SUCCEED";
	//		}
	//		return "ONPLAYING";
	//	},
	//	() => {
	//		document.removeEventListener("keydown", nextScene);
	//	},
	//);
	await displayScenes(introScenes);
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
		// play SUCCESS effect
		// and then play outro
	} else {
		//display retry ??
		//when hit Y, reload this frame, so simple
	}
};

let currentSceneIndex = 0;
let oldIntroSceneIndex = 0;

const introScenes = [
	{
		name: "./intro/intro-01.svg",
		x: 0,
		y: 0,
		width: 1910,
		height: 1000,
	},
];
const outroScenes = [];

async function displayScenes(scenes) {
	const sceneImg = new Image();
	for (const imageConfig of scenes) {
		board = document.getElementById("board");
		board.height = imageConfig.height;
		board.width = imageConfig.width;
		context = board.getContext("2d"); //used for drawing on the board
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
		await waitForKeyPress();
		await fadeOutImage(board, sceneImg);
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
	function fadeOutImage(canvas, image) {
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
			}, 1); // Adjust the interval time (50ms) for different fade-out speeds
		});
	}
}
async function displayCountDown() {
	board = document.getElementById("board");
	board.height = boardHeight;
	board.width = boardWidth;
	context = board.getContext("2d"); //used for drawing on the board
	for (let count = 4; count >= 0; count--) {
		birdImg = new Image();
		birdImg.src = birdSpriteFilename;
		birdImg.onload = function () {
			context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);
		};
		context.clearRect(0, 0, board.width, board.height);
		context.font = "80px Arial";
		context.fillStyle = "black";
		context.textAling = "center";
		switch (count) {
			case 4:
				const readyText = "READY?";
				const readyTextWidth = context.measureText(readyText).width;
				context.fillText(
					readyText,
					board.width / 2 - readyTextWidth / 2,
					board.height / 2,
				);
				break;
			case 3:
			case 2:
			case 1:
				context.fillText(count, board.width / 2, board.height / 2);
				break;
			case 0:
				const goText = "START!";
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
	topPipeImg.src = "./toppipe.png";

	bottomPipeImg = new Image();
	bottomPipeImg.src = "./bottompipe.png";
	document.addEventListener("keydown", moveBird);
	currentProgress = 0;
	setInterval(placePipes, 3000); //every 1.5 seconds
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
		y: randomPipeY + pipeHeight + openingSpace,
		width: pipeWidth,
		height: pipeHeight,
		passed: false,
	};
	if (pipeBottomFlag) pipeArray.push(bottomPipe);
}

function gameLoop() {
	context.clearRect(0, 0, board.width, board.height);
	//bird
	velocityY += gravity;
	// bird.y += velocityY;
	bird.y = Math.max(bird.y + velocityY, 0); //apply gravity to current bird.y, limit the bird.y to top of the canvas
	context.drawImage(birdImg, bird.x, bird.y, bird.width, bird.height);

	if (bird.y > board.height) {
		gameOver = true;
	}

	//pipes
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

	if (score >= GOAL_SCORE && currentProgress >= GAME_TOTAL_PROGRESS) {
		gameEndOK = true;
	}
	currentProgress++;

	function detectCollision(a, b) {
		return (
			a.x < b.x + b.width && //a's top left corner doesn't reach b's top right corner
			a.x + a.width > b.x && //a's top right corner passes b's top left corner
			a.y < b.y + b.height && //a's top left corner doesn't reach b's bottom left corner
			a.y + a.height > b.y
		); //a's bottom left corner passes b's top left corner
	}
}
