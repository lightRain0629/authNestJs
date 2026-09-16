import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
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
import { AccountService } from '../services';
import {
  BalancesDto,
  CreateAccountDto,
  CreateValuationDto,
  ListAccountsDto,
  NetWorthHistoryDto,
  UpdateAccountDto,
} from '../dto';
import {
  AccountResponse,
  BalancesResponse,
  DebtsResponse,
  NetWorthHistoryResponse,
  ValuationResponse,
} from '../responses';

@ApiTags('finance/accounts')
@ApiBearerAuth('access-token')
@Controller('finance/accounts')
@UseInterceptors(ClassSerializerInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @ApiOperation({ summary: 'Create an account, asset or debt' })
  @ApiCreatedResponse({ type: AccountResponse })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponse> {
    return new AccountResponse(await this.accountService.create(user.id, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List accounts for the current user' })
  @ApiOkResponse({ type: [AccountResponse] })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListAccountsDto,
  ): Promise<AccountResponse[]> {
    const accounts = await this.accountService.findAll(user.id, query);
    return accounts.map((a) => new AccountResponse(a));
  }

  @Get('balances')
  @ApiOperation({
    summary: 'Balance of every account plus net worth in one call',
  })
  @ApiOkResponse({ type: BalancesResponse })
  async balances(
    @CurrentUser() user: JwtPayload,
    @Query() query: BalancesDto,
  ): Promise<BalancesResponse> {
    return this.accountService.getBalances(user.id, query);
  }

  @Get('net-worth/history')
  @ApiOperation({ summary: 'Net worth over time for charting' })
  @ApiOkResponse({ type: NetWorthHistoryResponse })
  async netWorthHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: NetWorthHistoryDto,
  ): Promise<NetWorthHistoryResponse> {
    return this.accountService.getNetWorthHistory(user.id, query);
  }

  @Get('debts')
  @ApiOperation({ summary: 'Debts you owe and money lent out' })
  @ApiOkResponse({ type: DebtsResponse })
  async debts(
    @CurrentUser() user: JwtPayload,
    @Query() query: BalancesDto,
  ): Promise<DebtsResponse> {
    return this.accountService.getDebts(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AccountResponse> {
    return new AccountResponse(await this.accountService.findOne(id, user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponse> {
    return new AccountResponse(
      await this.accountService.update(id, user.id, dto),
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an unused account, archive one that has history',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponse })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AccountResponse> {
    return new AccountResponse(await this.accountService.remove(id, user.id));
  }

  @Post(':id/valuations')
  @ApiOperation({ summary: 'Record a new value for a VALUED account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ValuationResponse })
  async addValuation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateValuationDto,
  ): Promise<ValuationResponse> {
    return new ValuationResponse(
      await this.accountService.addValuation(id, user.id, dto),
    );
  }

  @Get(':id/valuations')
  @ApiOperation({ summary: 'Valuation history for an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [ValuationResponse] })
  async listValuations(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ValuationResponse[]> {
    const valuations = await this.accountService.listValuations(id, user.id);
    return valuations.map((v) => new ValuationResponse(v));
  }

  @Delete(':id/valuations/:valuationId')
  @ApiOperation({ summary: 'Delete a valuation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'valuationId', format: 'uuid' })
  @ApiOkResponse({ type: ValuationResponse })
  async removeValuation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valuationId', ParseUUIDPipe) valuationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ValuationResponse> {
    await this.accountService.findOne(id, user.id);
    return new ValuationResponse(
      await this.accountService.removeValuation(valuationId, user.id),
    );
  }
}
