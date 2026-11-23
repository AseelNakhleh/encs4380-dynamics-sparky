
#define motorDirPin 7
#define motorPWMPin 9
#define enablePin 8
#define encoderPinA 2

int previousA;
unsigned long pulses = 0;
unsigned long lastTime = 0;

void setup() {
  Serial.begin(9600);

  pinMode(motorDirPin, OUTPUT);
  pinMode(motorPWMPin, OUTPUT);
  pinMode(enablePin, OUTPUT);
  pinMode(encoderPinA, INPUT_PULLUP);

  digitalWrite(motorDirPin, HIGH);
  digitalWrite(enablePin, HIGH);
  analogWrite(motorPWMPin, 100);

  previousA = digitalRead(encoderPinA);

  Serial.println("Time_ms,PWM,Pulses_per_second");
}

void loop() {
  int currentA = digitalRead(encoderPinA);

  if (previousA == LOW && currentA == HIGH) {
    pulses++;
  }

  previousA = currentA;

  if (millis() - lastTime >= 1000) {
    lastTime = millis();

    Serial.print(millis());
    Serial.print(",100,");
    Serial.println(pulses);

    pulses = 0;
  }
  delay(5);
}
