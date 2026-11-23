
#define motorDirPin 7
#define motorPWMPin 9
#define enablePin 8
#define encoderPinA 2

volatile unsigned long pulses = 0;

unsigned long startTime;
unsigned long lastTime;

const unsigned long sampleTime = 100;
const unsigned long stepTime = 5000;

const int initialPWM = 100;
const int stepPWM = 200;

bool stepped = false;

void countPulse() {
  pulses++;
}

void setup() {
  Serial.begin(9600);

  pinMode(motorDirPin, OUTPUT);
  pinMode(motorPWMPin, OUTPUT);
  pinMode(enablePin, OUTPUT);
  pinMode(encoderPinA, INPUT_PULLUP);

  attachInterrupt(
    digitalPinToInterrupt(encoderPinA),
    countPulse,
    RISING
  );

  // Use the direction that worked previously
  digitalWrite(motorDirPin, HIGH);
  digitalWrite(enablePin, HIGH);

  // Start at PWM 100
  analogWrite(motorPWMPin, initialPWM);

  startTime = millis();
  lastTime = startTime;

  Serial.println("Time_ms,PWM,Speed_pulses_s");
}

void loop() {
  unsigned long now = millis();
  unsigned long elapsed = now - startTime;

  // Increase PWM from 100 to 200 after 5 seconds
  if (elapsed >= stepTime && !stepped) {
    analogWrite(motorPWMPin, stepPWM);
    stepped = true;
  }

  // Measure speed every 100 ms
  if (now - lastTime >= sampleTime) {

    unsigned long interval = now - lastTime;
    lastTime = now;

    noInterrupts();
    unsigned long count = pulses;
    pulses = 0;
    interrupts();

    float speed = count * 1000.0 / interval;

    Serial.print(elapsed);
    Serial.print(",");
    Serial.print(stepped ? stepPWM : initialPWM);
    Serial.print(",");
    Serial.println(speed);
  }
}
