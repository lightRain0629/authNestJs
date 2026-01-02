import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { ArticleService } from '../services';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ListArticlesDto,
} from '../dto';
import { ArticleResponse } from '../responses';

@ApiTags('finance/articles')
@ApiBearerAuth('access-token')
@Controller('finance/articles')
@UseInterceptors(ClassSerializerInterceptor)
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a finance article (category)' })
  @ApiCreatedResponse({ type: ArticleResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateArticleDto,
  ): Promise<ArticleResponse> {
    const article = await this.articleService.create(user.id, dto);
    return new ArticleResponse(article);
  }

  @Get()
  @ApiOperation({ summary: 'List all finance articles for current user' })
  @ApiOkResponse({ type: [ArticleResponse] })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListArticlesDto,
  ): Promise<ArticleResponse[]> {
    const articles = await this.articleService.findAll(user.id, query);
    return articles.map((a) => new ArticleResponse(a));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single finance article' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ArticleResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ArticleResponse> {
    const article = await this.articleService.findOne(id, user.id);
    return new ArticleResponse(article);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a finance article' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ArticleResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleResponse> {
    const article = await this.articleService.update(id, user.id, dto);
    return new ArticleResponse(article);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or archive a finance article' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ArticleResponse })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ArticleResponse> {
    const article = await this.articleService.remove(id, user.id);
    return new ArticleResponse(article);
  }
}
