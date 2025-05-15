import pygame
import random
import time
import sys
import cv2
import mediapipe as mp
import ssl
import certifi

ssl._create_default_https_context = ssl._create_unverified_context


# 初始化pygame和mediapipe
pygame.init()
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7)

# 屏幕设置
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 600
MAIN_WIDTH = 800
SIDE_WIDTH = SCREEN_WIDTH - MAIN_WIDTH

# 颜色定义
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# 游戏设置
GRID_SIZE = 20
GRID_WIDTH = MAIN_WIDTH // GRID_SIZE
GRID_HEIGHT = SCREEN_HEIGHT // GRID_SIZE
SNAKE_SPEED = 1  # 每秒移动1格

class SnakeGame:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption('贪吃蛇游戏')
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont('Arial', 30)
        self.direction_font = pygame.font.SysFont('Arial', 50)
        
        # 游戏状态
        self.reset_game()
        
        # 果实刷新计时
        self.last_fruit_time = time.time()
        
        # 摄像头设置
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, SIDE_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, SCREEN_HEIGHT // 2)
        self.detected_direction = None
        
    def reset_game(self):
        """重置游戏状态"""
        self.snake = [(GRID_WIDTH // 2, GRID_HEIGHT // 2)]
        self.direction = (1, 0)  # 初始向右移动
        self.fruits = []
        self.game_over = False
        self.generate_fruits(4)  # 初始生成4个果实
        self.last_move_time = time.time()
        
    def generate_fruits(self, count):
        """生成指定数量的果实"""
        for _ in range(count):
            while True:
                x = random.randint(2, GRID_WIDTH - 3)
                y = random.randint(2, GRID_HEIGHT - 3)
                if (x, y) not in self.snake and (x, y) not in [f[:2] for f in self.fruits]:
                    self.fruits.append((x, y, RED))
                    break
                    
    def handle_events(self):
        """处理用户输入"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.cap.release()
                pygame.quit()
                sys.exit()
                
            if event.type == pygame.KEYDOWN:
                if self.game_over and event.key == pygame.K_r:  # 按R键重新开始
                    self.reset_game()
    
    def detect_hand_direction(self):
        """检测手指方向"""
        success, image = self.cap.read()
        if not success:
            return None
            
        # 转换图像格式
        image = cv2.cvtColor(cv2.flip(image, 1), cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = hands.process(image)
        
        # 绘制手势骨架
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                
                # 获取食指指尖和指根坐标
                index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
                index_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_MCP]
                
                # 计算方向向量
                dx = index_tip.x - index_mcp.x
                dy = index_tip.y - index_mcp.y
                
                # 确定主要方向
                if abs(dx) > abs(dy):
                    self.detected_direction = "RIGHT" if dx > 0 else "LEFT"
                else:
                    self.detected_direction = "DOWN" if dy > 0 else "UP"
        
        # 返回处理后的图像
        return image
    
    def update(self):
        """更新游戏状态"""
        if self.game_over:
            return
            
        current_time = time.time()
        
        # 每1秒移动一次
        if current_time - self.last_move_time >= 0.5 / SNAKE_SPEED:
            self.last_move_time = current_time
            
            # 更新手势方向
            hand_image = self.detect_hand_direction()
            if self.detected_direction:
                if self.detected_direction == "UP" and self.direction != (0, 1):
                    self.direction = (0, -1)
                elif self.detected_direction == "DOWN" and self.direction != (0, -1):
                    self.direction = (0, 1)
                elif self.detected_direction == "LEFT" and self.direction != (1, 0):
                    self.direction = (-1, 0)
                elif self.detected_direction == "RIGHT" and self.direction != (-1, 0):
                    self.direction = (1, 0)
            
            # 移动蛇
            head_x, head_y = self.snake[0]
            new_head = (head_x + self.direction[0], head_y + self.direction[1])
            
            # 检查碰撞
            if (new_head[0] < 0 or new_head[0] >= GRID_WIDTH or 
                new_head[1] < 0 or new_head[1] >= GRID_HEIGHT or 
                new_head in self.snake):
                self.game_over = True
                return
                
            self.snake.insert(0, new_head)
            
            # 检查是否吃到果实
            ate_fruit = False
            for i, fruit in enumerate(self.fruits):
                if new_head == fruit[:2]:
                    self.fruits.pop(i)
                    ate_fruit = True
                    break
                    
            if not ate_fruit:
                self.snake.pop()
                
        # 每20秒刷新果实
        if current_time - self.last_fruit_time >= 20:
            self.last_fruit_time = current_time
            self.generate_fruits(4)
    
    def draw(self):
        """绘制游戏界面"""
        self.screen.fill(BLACK)
        
        # 绘制主游戏区域
        pygame.draw.rect(self.screen, WHITE, (0, 0, MAIN_WIDTH, SCREEN_HEIGHT), 1)
        
        # 绘制蛇
        for segment in self.snake:
            pygame.draw.rect(self.screen, GREEN, 
                            (segment[0] * GRID_SIZE, segment[1] * GRID_SIZE, 
                             GRID_SIZE, GRID_SIZE))
        
        # 绘制果实
        for fruit in self.fruits:
            pygame.draw.rect(self.screen, fruit[2], 
                            (fruit[0] * GRID_SIZE, fruit[1] * GRID_SIZE, 
                             GRID_SIZE, GRID_SIZE))
        
        # 绘制辅助区域
        pygame.draw.rect(self.screen, WHITE, (MAIN_WIDTH, 0, SIDE_WIDTH, SCREEN_HEIGHT), 1)
        
        # 显示摄像头画面
        hand_image = self.detect_hand_direction()
        if hand_image is not None:
            # 转换OpenCV图像为Pygame表面
            hand_image = cv2.resize(hand_image, (SIDE_WIDTH, SCREEN_HEIGHT // 2))
            hand_image = cv2.cvtColor(hand_image, cv2.COLOR_BGR2RGB)
            hand_surface = pygame.surfarray.make_surface(hand_image.swapaxes(0, 1))
            self.screen.blit(hand_surface, (MAIN_WIDTH, 0))
            
            # 显示检测到的方向
            if self.detected_direction:
                direction_text = self.direction_font.render(
                    f"Direction: {self.detected_direction}", True, GREEN)
                self.screen.blit(direction_text, 
                               (MAIN_WIDTH + 20, SCREEN_HEIGHT // 2 + 20))
        
        # 游戏结束显示
        if self.game_over:
            # 创建半透明背景
            s = pygame.Surface((MAIN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
            s.fill((0, 0, 0, 128))
            self.screen.blit(s, (0, 0))
            
            # 显示游戏结束文本
            game_over_text = self.font.render("GAME OVER", True, RED)
            restart_text = self.font.render("Press R Key to Restart", True, WHITE)
            
            # 居中显示文本
            self.screen.blit(game_over_text, 
                           (MAIN_WIDTH // 2 - game_over_text.get_width() // 2, 
                            SCREEN_HEIGHT // 2 - 50))
            self.screen.blit(restart_text, 
                           (MAIN_WIDTH // 2 - restart_text.get_width() // 2, 
                            SCREEN_HEIGHT // 2 + 20))
        
        pygame.display.flip()
    
    def run(self):
        """运行游戏主循环"""
        while True:
            self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(60)

if __name__ == "__main__":
    game = SnakeGame()
    game.run()
